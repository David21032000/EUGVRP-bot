require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, ChannelType, Events, Collection } = require('discord.js');
const { Pool } = require('pg');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.User, Partials.GuildMember]
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false
});

const SESSION_CHANNEL_ID = '1391712465364193323';
const PS_RADIO_CHANNEL_ID = '1391845254298210304';
const PATREON_ROLE = 'Patreon';
const PUBLIC_SERVICES = {
  fd: 'Fire & Rescue',
  le: 'Law Enforcement',
  dot: 'DOT'
};

let currentSession = null;

client.commands = new Collection();

// ===== Utility Functions =====

async function cleanupExpiredData() {
  const now = new Date();
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
  await pool.query(`DELETE FROM tickets WHERE created_at < $1`, [tenDaysAgo]);
  await pool.query(`DELETE FROM logs WHERE created_at < $1`, [tenDaysAgo]);
}

async function checkUserAccess(interaction) {
  const member = interaction.member;
  if (!member.roles.cache.some(role => Object.values(PUBLIC_SERVICES).includes(role.name)) && !member.roles.cache.has(PATREON_ROLE)) {
    return false;
  }
  return true;
}

async function getUserShift(userId) {
  const res = await pool.query(`SELECT department FROM shifts WHERE user_id = $1`, [userId]);
  return res.rows.length > 0 ? res.rows[0].department : null;
}

function canRegisterMoreCars(member, currentCount) {
  const isPatreon = member.roles.cache.some(role => role.name === PATREON_ROLE);
  const limit = isPatreon ? 20 : 5;
  return currentCount < limit;
}

// ===== Event: Ready =====

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  setInterval(cleanupExpiredData, 1000 * 60 * 60); // every hour
});

// ===== Event: Interaction =====

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, member, channel } = interaction;

  if (commandName === 'caradd') {
    const name = options.getString('name');
    const color = options.getString('color');
    const plate = options.getString('plate');
    const existing = await pool.query(`SELECT * FROM cars WHERE user_id = $1`, [member.id]);

    if (!canRegisterMoreCars(member, existing.rowCount)) {
      return interaction.reply({ content: 'You have reached your car limit.', ephemeral: true });
    }

    await pool.query(`INSERT INTO cars (user_id, username, car_name, color, plate) VALUES ($1, $2, $3, $4, $5)`, [
      member.id, member.user.tag, name, color, plate.toUpperCase()
    ]);
    interaction.reply({ content: `✅ Registered ${name} (${plate.toUpperCase()})`, ephemeral: true });

  } else if (commandName === 'cardelete') {
    const plate = options.getString('plate');
    const result = await pool.query(`DELETE FROM cars WHERE user_id = $1 AND plate = $2`, [member.id, plate.toUpperCase()]);
    if (result.rowCount === 0) {
      interaction.reply({ content: 'Car not found.', ephemeral: true });
    } else {
      interaction.reply({ content: `🗑️ Car with plate ${plate.toUpperCase()} deleted.`, ephemeral: true });
    }

  } else if (commandName === 'plate') {
    const plate = options.getString('plate');
    const car = await pool.query(`SELECT username FROM cars WHERE plate = $1`, [plate.toUpperCase()]);
    if (car.rowCount === 0) {
      interaction.reply({ content: '🚫 The car is not registered.', ephemeral: true });
    } else {
      interaction.reply({ content: `✅ Plate belongs to ${car.rows[0].username}`, ephemeral: true });
    }

  } else if (commandName === 'ticket') {
    const target = options.getUser('user');
    const reason = options.getString('reason');
    const proof = options.getString('proof');
    await pool.query(`INSERT INTO tickets (user_id, username, reason, proof_link) VALUES ($1, $2, $3, $4)`, [
      target.id, target.tag, reason, proof
    ]);

    // Check for auto-log
    const tickets = await pool.query(`SELECT COUNT(*) FROM tickets WHERE user_id = $1`, [target.id]);
    const count = parseInt(tickets.rows[0].count);
    if (count >= 10) {
      await pool.query(`INSERT INTO logs (user_id, username, reason) VALUES ($1, $2, $3)`, [
        target.id, target.tag, 'Auto-log: 10+ tickets'
      ]);
    }

    const logs = await pool.query(`SELECT COUNT(*) FROM logs WHERE user_id = $1`, [target.id]);
    if (parseInt(logs.rows[0].count) >= 3) {
      target.send('❌ You have been session banned due to 3 or more logs.');
    }

    target.send(`📩 You received a ticket: **${reason}**${proof ? `\nProof: ${proof}` : ''}`);
    interaction.reply({ content: `✅ Ticket sent to ${target.tag}`, ephemeral: true });

  } else if (commandName === 'ticketdelete') {
    const id = options.getInteger('id');
    const result = await pool.query(`DELETE FROM tickets WHERE id = $1`, [id]);
    if (result.rowCount === 0) {
      interaction.reply({ content: '❌ Ticket not found.', ephemeral: true });
    } else {
      interaction.reply({ content: `🗑️ Ticket ${id} deleted.`, ephemeral: true });
    }

  } else if (commandName === 'log') {
    const user = options.getUser('user');
    const reason = options.getString('reason');
    await pool.query(`INSERT INTO logs (user_id, username, reason) VALUES ($1, $2, $3)`, [
      user.id, user.tag, reason
    ]);
    interaction.reply({ content: `✅ Log added for ${user.tag}`, ephemeral: true });

  } else if (commandName === 'profile') {
    const cars = await pool.query(`SELECT car_name, color, plate FROM cars WHERE user_id = $1`, [member.id]);
    const tickets = await pool.query(`SELECT reason, created_at FROM tickets WHERE user_id = $1`, [member.id]);
    const logs = await pool.query(`SELECT reason, created_at FROM logs WHERE user_id = $1`, [member.id]);

    const embed = new EmbedBuilder()
      .setTitle(`${member.user.tag}'s Profile`)
      .setDescription(`**Cars:**\n${cars.rows.map(c => `• ${c.car_name} (${c.color}) - ${c.plate}`).join('\n') || 'None'}\n\n**Tickets:**\n${tickets.rows.map(t => `• ${t.reason} (${new Date(t.created_at).toLocaleDateString()})`).join('\n') || 'None'}\n\n**Logs:**\n${logs.rows.map(l => `• ${l.reason} (${new Date(l.created_at).toLocaleDateString()})`).join('\n') || 'None'}`)
      .setColor('Blue');

    interaction.reply({ embeds: [embed], ephemeral: true });

  } else if (commandName === 'shift') {
    const sub = interaction.options.getSubcommand();
    if (sub === 'start') {
      const department = options.getString('department');
      const roleName = PUBLIC_SERVICES[department];
      const hasRole = member.roles.cache.some(r => r.name === roleName);

      if (!hasRole) {
        return interaction.reply({ content: `❌ You don't have the ${roleName} role.`, ephemeral: true });
      }

      await pool.query(`INSERT INTO shifts (user_id, department) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET department = EXCLUDED.department`, [
        member.id, department
      ]);
      interaction.reply({ content: `✅ Shift started as ${roleName}.`, ephemeral: true });

    } else if (sub === 'end') {
      await pool.query(`DELETE FROM shifts WHERE user_id = $1`, [member.id]);
      interaction.reply({ content: `✅ Shift ended.`, ephemeral: true });
    }

  } else if (commandName === 'session') {
    const sub = options.getSubcommand();
    if (sub === 'start') {
      const link = options.getString('link');

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('join_session')
          .setLabel('Join Session')
          .setStyle(ButtonStyle.Link)
          .setURL(link)
      );

      const message = await client.channels.cache.get(SESSION_CHANNEL_ID)?.send({
        content: `🚨 A session will begin in 5 minutes.\nOnly Public Services and Patreon can join early.`,
        components: [row]
      });

      currentSession = { messageId: message.id, link };
      interaction.reply({ content: '✅ Session started.', ephemeral: true });

    } else if (sub === 'end') {
      if (currentSession) {
        const sessionChannel = client.channels.cache.get(SESSION_CHANNEL_ID);
        const msg = await sessionChannel.messages.fetch(currentSession.messageId).catch(() => null);
        if (msg) await msg.delete();

        await pool.query(`DELETE FROM shifts`);
        currentSession = null;
        interaction.reply({ content: '🛑 Session ended and all shifts cleared.', ephemeral: true });
      } else {
        interaction.reply({ content: '⚠️ No active session found.', ephemeral: true });
      }
    }
  }
});

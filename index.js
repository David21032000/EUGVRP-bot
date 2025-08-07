require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { Pool } = require('pg');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel],
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

let sessionMessageId = null;
const sessionChannelId = '1391712465364193323';
const psRadioChannelId = '1391845254298210304';

function hasRole(member, name) {
  return member.roles.cache.some(role => role.name.toLowerCase() === name.toLowerCase());
}

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await cleanupExpiredData();
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, member, guild } = interaction;

  if (commandName === 'caradd') {
    const name = options.getString('name');
    const color = options.getString('color');
    const plate = options.getString('plate').toUpperCase();

    const maxCars = hasRole(member, 'Patreon') ? 20 : 5;
    const carCount = await pool.query('SELECT COUNT(*) FROM cars WHERE user_id = $1', [member.id]);
    if (parseInt(carCount.rows[0].count) >= maxCars) return interaction.reply({ content: `❌ You can only register up to ${maxCars} cars.`, ephemeral: true });

    await pool.query('INSERT INTO cars (user_id, username, car_name, color, plate, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
      [member.id, member.user.username, name, color, plate]);

    return interaction.reply({ content: `✅ Car registered: ${name} (${color}) - Plate: ${plate}`, ephemeral: true });
  }

  if (commandName === 'cardelete') {
    const plate = options.getString('plate').toUpperCase();
    const result = await pool.query('DELETE FROM cars WHERE user_id = $1 AND plate = $2', [member.id, plate]);
    return interaction.reply({ content: result.rowCount > 0 ? '✅ Car deleted.' : '❌ Car not found.', ephemeral: true });
  }

  if (commandName === 'plate') {
    const plate = options.getString('plate').toUpperCase();
    const result = await pool.query('SELECT username FROM cars WHERE plate = $1', [plate]);
    return interaction.reply({ content: result.rowCount > 0 ? `✅ Registered to ${result.rows[0].username}` : '❌ The car is not registered.', ephemeral: true });
  }

  if (commandName === 'profile') {
    const cars = await pool.query('SELECT * FROM cars WHERE user_id = $1', [member.id]);
    const tickets = await pool.query('SELECT * FROM tickets WHERE user_id = $1', [member.id]);
    const logs = await pool.query('SELECT * FROM logs WHERE user_id = $1', [member.id]);

    const embed = new EmbedBuilder()
      .setTitle(`${member.user.username}'s Profile`)
      .addFields(
        { name: '🚗 Cars', value: cars.rows.map(c => `${c.car_name} (${c.color}) – ${c.plate}`).join('\n') || 'None' },
        { name: '📋 Tickets', value: tickets.rows.map(t => `• ${t.reason}`).join('\n') || 'None' },
        { name: '⚠️ Logs', value: logs.rows.map(l => `• ${l.reason}`).join('\n') || 'None' }
      )
      .setColor('Blue');

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

 if (commandName === 'ticket') {
  try {
    const target = options.getUser('user');
    const reason = options.getString('reason');
    const proof = options.getString('proof') || null;

    await pool.query(
      'INSERT INTO tickets (user_id, username, reason, proof_link, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [target.id, target.username, reason, proof]
    );

    const count = await pool.query('SELECT COUNT(*) FROM tickets WHERE user_id = $1', [target.id]);
    if (parseInt(count.rows[0].count) >= 10) {
      await pool.query(
        'INSERT INTO logs (user_id, username, reason, created_at) VALUES ($1, $2, $3, NOW())',
        [target.id, target.username, '10 tickets received']
      );
    }

    const logCount = await pool.query('SELECT COUNT(*) FROM logs WHERE user_id = $1', [target.id]);
    if (parseInt(logCount.rows[0].count) >= 3) {
      await target.send('⚠️ You are session banned due to receiving 3 or more logs.');
    }

    const embed = new EmbedBuilder()
      .setTitle('🚨 Ticket Issued')
      .setDescription(`**User:** ${target}\n**Reason:** ${reason}\n**Proof:** ${proof || 'None'}`)
      .setColor('Red');

    await interaction.channel.send({ embeds: [embed] });
    await target.send({ embeds: [embed] });

    return interaction.reply({ content: '✅ Ticket issued.', ephemeral: true });

  } catch (err) {
    console.error('❌ Error in /ticket:', err);
    return interaction.reply({ content: '❌ Failed to issue ticket.', ephemeral: true });
  }
}

    const target = options.getUser('user');
    const reason = options.getString('reason');
    const proof = options.getString('proof') || null;

    await pool.query('INSERT INTO tickets (user_id, username, reason, proof_link, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [target.id, target.username, reason, proof]);

    const count = await pool.query('SELECT COUNT(*) FROM tickets WHERE user_id = $1', [target.id]);
    if (parseInt(count.rows[0].count) >= 10) {
      await pool.query('INSERT INTO logs (user_id, username, reason, created_at) VALUES ($1, $2, $3, NOW())',
        [target.id, target.username, '10 tickets received']);
    }

    const logCount = await pool.query('SELECT COUNT(*) FROM logs WHERE user_id = $1', [target.id]);
    if (parseInt(logCount.rows[0].count) >= 3) {
      target.send('⚠️ You are session banned due to 3 or more logs.');
    }

    const embed = new EmbedBuilder()
      .setTitle('🚨 Ticket Issued')
      .setDescription(`**User:** ${target}\n**Reason:** ${reason}\n**Proof:** ${proof || 'None'}`)
      .setColor('Red');

    await interaction.channel.send({ embeds: [embed] });
    await target.send({ embeds: [embed] });

    return interaction.reply({ content: '✅ Ticket issued.', ephemeral: true });
  }

  if (commandName === 'ticketdelete') {
    const id = options.getInteger('id');
    const result = await pool.query('DELETE FROM tickets WHERE id = $1', [id]);
    return interaction.reply({ content: result.rowCount > 0 ? '✅ Ticket deleted.' : '❌ Ticket not found.', ephemeral: true });
  }

  if (commandName === 'log') {
    const target = options.getUser('user');
    const reason = options.getString('reason');

    await pool.query('INSERT INTO logs (user_id, username, reason, created_at) VALUES ($1, $2, $3, NOW())',
      [target.id, target.username, reason]);

    return interaction.reply({ content: `✅ Log added for ${target.username}`, ephemeral: true });
  }

  if (commandName === 'shift') {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      const department = options.getString('department');
      const requiredRole = department === 'fd' ? 'Fire & Rescue' : department === 'le' ? 'Law Enforcement' : 'DOT';
      if (!hasRole(member, requiredRole)) return interaction.reply({ content: `❌ You don’t have the ${requiredRole} role.`, ephemeral: true });

      await pool.query('INSERT INTO shifts (user_id, department) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET department = $2', [member.id, department]);
      return interaction.reply({ content: `✅ Shift started as ${requiredRole}.`, ephemeral: true });
    }

    if (sub === 'end') {
      await pool.query('DELETE FROM shifts WHERE user_id = $1', [member.id]);
      return interaction.reply({ content: `✅ Shift ended.`, ephemeral: true });
    }
  }

  if (commandName === 'session') {
    const sub = options.getSubcommand();

    if (sub === 'start') {
      const link = options.getString('link');

      const embed = new EmbedBuilder()
        .setTitle('📢 Session Starting')
        .setDescription('A roleplay session will begin in 5 minutes.\nOnly Public Services and Patreon can join early.')
        .setColor('Green');

      const button = new ButtonBuilder()
        .setLabel('Join Session')
        .setStyle(ButtonStyle.Link)
        .setURL(link);

      const row = new ActionRowBuilder().addComponents(button);
      const message = await client.channels.cache.get(sessionChannelId).send({ embeds: [embed], components: [row] });

      sessionMessageId = message.id;

      setTimeout(() => {
        const everyoneEmbed = EmbedBuilder.from(embed).setDescription('Session is now open to everyone.');
        client.channels.cache.get(sessionChannelId).send({ embeds: [everyoneEmbed] });
      }, 5 * 60 * 1000);

      return interaction.reply({ content: '✅ Session started.', ephemeral: true });
    }

    if (sub === 'end') {
      if (sessionMessageId) {
        const channel = client.channels.cache.get(sessionChannelId);
        try {
          const msg = await channel.messages.fetch(sessionMessageId);
          await msg.delete();
        } catch (err) {
          console.log('⚠️ Failed to delete session message:', err.message);
        }
        sessionMessageId = null;
      }

      await pool.query('DELETE FROM shifts');
      return interaction.reply({ content: '✅ Session ended. All shifts cleared.', ephemeral: true });
    }
  }
});

async function cleanupExpiredData() {
  await pool.query(`DELETE FROM tickets WHERE created_at < NOW() - INTERVAL '10 days'`);
  await pool.query(`DELETE FROM logs WHERE created_at < NOW() - INTERVAL '10 days'`);
}

client.login(process.env.TOKEN);

require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes,
  Collection,
  Events
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.User, Partials.GuildMember]
});

// 🔹 Config
const SESSION_CHANNEL_ID = '1391712465364193323';
const PS_RADIO_CHANNEL_ID = '1391845254298210304';

const PUBLIC_SERVICES = {
  fd: 'Fire & Rescue',
  le: 'Law Enforcement',
  dot: 'DOT'
};

const PATREON_ROLE = 'Patreon';
const SESSION_HOST_ROLE = 'Session Host';

let currentSession = null;
client.commands = new Collection();

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, member, guild } = interaction;

  // ===============================
  // 🔹 /shift
  // ===============================
  if (commandName === 'shift') {
    const sub = options.getSubcommand();
    if (sub === 'start') {
      const department = options.getString('department');
      const roleName = PUBLIC_SERVICES[department];
      const hasRole = member.roles.cache.some(r => r.name === roleName);

      if (!hasRole) {
        return interaction.reply({ content: `❌ You don't have the ${roleName} role.`, ephemeral: true });
      }

      interaction.reply({ content: `✅ You started your shift as ${roleName}.`, ephemeral: true });
    } else if (sub === 'end') {
      interaction.reply({ content: `🛑 You ended your shift.`, ephemeral: true });
    }

  // ===============================
  // 🔹 /session
  // ===============================
  } else if (commandName === 'session') {
    const sub = options.getSubcommand();

    // START SESSION
    if (sub === 'start') {
      const link = options.getString('link');

      // ✅ Doar Session Host poate porni sesiunea
      if (!member.roles.cache.some(r => r.name === SESSION_HOST_ROLE)) {
        return interaction.reply({ content: '❌ Only Session Hosts can start a session.', ephemeral: true });
      }

      const sessionChannel = client.channels.cache.get(SESSION_CHANNEL_ID);
      if (!sessionChannel) {
        return interaction.reply({ content: '⚠️ Session channel not found.', ephemeral: true });
      }

      // 🔗 Butonul de join
      const joinButton = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Join Session')
          .setStyle(ButtonStyle.Link)
          .setURL(link)
      );

      // 🔸 Embed inițial (doar pentru FD, LE, DOT, Patreon)
      const embed = new EmbedBuilder()
        .setTitle('🚨 Session Started')
        .setDescription(
          `**Session started by:** ${member}\n\n` +
          `**FD, LE, DOT & Patreon** may join **now**.\n` +
          `Civilians can join in **5 minutes.**`
        )
        .setColor('Red')
        .setTimestamp();

      const message = await sessionChannel.send({ embeds: [embed], components: [joinButton] });
      currentSession = message.id;

      await interaction.reply({ content: '✅ Session started successfully.', ephemeral: true });

      // Trimite anunț în PS-Radio
      const radio = guild.channels.cache.get(PS_RADIO_CHANNEL_ID);
      if (radio) {
        radio.send(`📢 **Session started by ${member.displayName}!** FD, LE, DOT & Patreon may join now. Civilians in 5 minutes.`);
      }

      // 🕒 După 5 minute, editează mesajul pentru civili
      setTimeout(async () => {
        const updatedEmbed = new EmbedBuilder()
          .setTitle('🚨 Session Open for All')
          .setDescription(
            `**Session started by:** ${member}\n\n` +
            `🔓 Civilians may now join the session.\n` +
            `🔗 [Join Here](${link})`
          )
          .setColor('Green')
          .setTimestamp();

        await message.edit({ embeds: [updatedEmbed], components: [joinButton] });
        if (radio) {
          radio.send(`✅ Civilians may now join the session!`);
        }
      }, 5 * 60 * 1000); // 5 minute

    // END SESSION
    } else if (sub === 'end') {
      // ✅ Doar Session Host poate închide sesiunea
      if (!member.roles.cache.some(r => r.name === SESSION_HOST_ROLE)) {
        return interaction.reply({ content: '❌ Only Session Hosts can end a session.', ephemeral: true });
      }

      const sessionChannel = client.channels.cache.get(SESSION_CHANNEL_ID);
      if (currentSession && sessionChannel) {
        const msg = await sessionChannel.messages.fetch(currentSession).catch(() => null);
        if (msg) await msg.delete();
        currentSession = null;
        interaction.reply({ content: '🛑 Session ended and message removed.', ephemeral: true });

        const radio = guild.channels.cache.get(PS_RADIO_CHANNEL_ID);
        if (radio) {
          radio.send(`🛑 **The current session has ended.**`);
        }
      } else {
        interaction.reply({ content: '⚠️ No active session found.', ephemeral: true });
      }
    }

  // ===============================
  // 🔹 /ticket
  // ===============================
  } else if (commandName === 'ticket') {
    const target = options.getUser('user');
    const reason = options.getString('reason');
    const proof = options.getString('proof');

    const embed = new EmbedBuilder()
      .setTitle('📋 New Ticket')
      .setDescription(`**User:** ${target.tag}\n**Reason:** ${reason}${proof ? `\n**Proof:** ${proof}` : ''}`)
      .setColor('Red');

    await target.send({ content: `📩 You received a ticket.`, embeds: [embed] }).catch(() => null);
    interaction.reply({ content: `✅ Ticket sent to ${target.tag}.`, ephemeral: true });

  // ===============================
  // 🔹 /log
  // ===============================
  } else if (commandName === 'log') {
    const target = options.getUser('user');
    const reason = options.getString('reason');

    const embed = new EmbedBuilder()
      .setTitle('⚠️ User Log')
      .setDescription(`**User:** ${target.tag}\n**Reason:** ${reason}`)
      .setColor('Orange');

    interaction.reply({ content: `📝 Log noted for ${target.tag}.`, embeds: [embed], ephemeral: true });
  }
});

client.login(process.env.TOKEN);

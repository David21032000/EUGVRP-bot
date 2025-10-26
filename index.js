require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Collection,
  Events
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.User, Partials.GuildMember]
});

// ========================
// ⚙️ Config
// ========================
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
let activeShifts = new Map(); // Map(userId -> department)

// ========================
// 🚀 Ready
// ========================
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ========================
// 🎯 Slash Command Handler
// ========================
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, member, guild } = interaction;

  // ==================================================
  // 🔹 /shift start /shift end
  // ==================================================
  if (commandName === 'shift') {
    const sub = options.getSubcommand();
    if (sub === 'start') {
      const department = options.getString('department');
      const roleName = PUBLIC_SERVICES[department];
      if (!roleName) return interaction.reply({ content: '❌ Invalid department.', ephemeral: true });

      const hasRole = member.roles.cache.some(r => r.name === roleName);
      if (!hasRole) {
        return interaction.reply({ content: `❌ You don't have the ${roleName} role.`, ephemeral: true });
      }

      if (activeShifts.has(member.id)) {
        return interaction.reply({ content: '⚠️ You already started a shift.', ephemeral: true });
      }

      activeShifts.set(member.id, roleName);
      interaction.reply({ content: `🟢 You started your shift as **${roleName}**.`, ephemeral: true });

    } else if (sub === 'end') {
      if (!activeShifts.has(member.id)) {
        return interaction.reply({ content: '⚠️ You have no active shift to end.', ephemeral: true });
      }

      const dept = activeShifts.get(member.id);
      activeShifts.delete(member.id);
      interaction.reply({ content: `🔴 You ended your shift as **${dept}**.`, ephemeral: true });
    }

  // ==================================================
  // 🔹 /session start /session end
  // ==================================================
  } else if (commandName === 'session') {
    const sub = options.getSubcommand();

    // ========================
    // 🟢 /session start
    // ========================
    if (sub === 'start') {
      const link = options.getString('link');

      // Only Session Host can start
      if (!member.roles.cache.some(r => r.name === SESSION_HOST_ROLE)) {
        return interaction.reply({ content: '❌ Only Session Hosts can start a session.', ephemeral: true });
      }

      const sessionChannel = guild.channels.cache.get(SESSION_CHANNEL_ID);
      if (!sessionChannel) return interaction.reply({ content: '⚠️ Session channel not found.', ephemeral: true });

      // Embed inițial (fără link)
      const embed = new EmbedBuilder()
        .setTitle('🚨 Session Started')
        .setDescription(`**Started by:** ${member}\n\nFD, LE, DOT & Patreon may join now.\nCivilians can join in **5 minutes**.`)
        .setColor('Red')
        .setTimestamp();

      const msg = await sessionChannel.send({ embeds: [embed] });
      currentSession = msg.id;

      interaction.reply({ content: '✅ Session started successfully.', ephemeral: true });

      // Anunț în PS-Radio
      const radio = guild.channels.cache.get(PS_RADIO_CHANNEL_ID);
      if (radio) {
        radio.send(`📢 **Session started by ${member.displayName}!** FD, LE, DOT & Patreon may join now. Civilians in 5 minutes.`);
      }

      // 🕒 După 5 minute -> adaugă linkul în embed
      setTimeout(async () => {
        const updatedEmbed = new EmbedBuilder()
          .setTitle('🚨 Session Open for All')
          .setDescription(`**Started by:** ${member}\n\n🔓 Civilians may now join!\n🔗 [Join Session Here](${link})`)
          .setColor('Green')
          .setTimestamp();

        await msg.edit({ embeds: [updatedEmbed] });

        if (radio) radio.send(`✅ Civilians may now join the session!`);
      }, 5 * 60 * 1000);

    // ========================
    // 🔴 /session end
    // ========================
    } else if (sub === 'end') {
      // Only Session Host can end
      if (!member.roles.cache.some(r => r.name === SESSION_HOST_ROLE)) {
        return interaction.reply({ content: '❌ Only Session Hosts can end a session.', ephemeral: true });
      }

      const sessionChannel = guild.channels.cache.get(SESSION_CHANNEL_ID);
      if (currentSession && sessionChannel) {
        const msg = await sessionChannel.messages.fetch(currentSession).catch(() => null);
        if (msg) await msg.delete();
        currentSession = null;

        // Oprire automată a tuturor shifturilor publice
        activeShifts.clear();

        const endEmbed = new EmbedBuilder()
          .setTitle('🛑 Session Ended')
          .setDescription(
            'The session has concluded.\n\n' +
            'All active shifts from **Fire & Rescue**, **Law Enforcement**, and **DOT** have been ended.\n\n' +
            'Thank you for your service!'
          )
          .setColor('Red')
          .setTimestamp();

        const radio = guild.channels.cache.get(PS_RADIO_CHANNEL_ID);
        if (radio) radio.send({ embeds: [endEmbed] });

        interaction.reply({ content: '🛑 Session ended successfully.', ephemeral: true });
      } else {
        interaction.reply({ content: '⚠️ No active session found.', ephemeral: true });
      }
    }
  }
});

client.login(process.env.TOKEN);

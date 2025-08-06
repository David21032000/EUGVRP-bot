const { Client, GatewayIntentBits, Partials, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel]
});

let activeSession = null;
let sessionLink = null;
let sessionStartTime = null;
let sessionChannel = null;
const shiftStatus = new Map();

client.once(Events.ClientReady, () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (interaction.isChatInputCommand()) {
    const { commandName } = interaction;

    // /shift start
    if (commandName === 'shift') {
      const department = interaction.options.getString('department');
      const roleMap = {
        fire: 'Fire & Rescue',
        police: 'Law Enforcement',
        dot: 'DOT'
      };
      const requiredRole = roleMap[department];

      if (!interaction.member.roles.cache.some(role => role.name === requiredRole)) {
        return interaction.reply({ content: `⛔ You don’t have the role to start a shift as ${requiredRole}.`, ephemeral: true });
      }

      shiftStatus.set(interaction.user.id, requiredRole);

      const psRadio = interaction.guild.channels.cache.find(ch => ch.name === 'ps-radio');
      if (psRadio) {
        await psRadio.send(`📢 ${interaction.user} started a shift as **${requiredRole}**.`);
      }

      return interaction.reply({ content: `✅ Shift started as ${requiredRole}.`, ephemeral: true });
    }

    // /session start
    if (commandName === 'session') {
      if (!interaction.member.roles.cache.some(role => role.name === 'Session Host')) {
        return interaction.reply({ content: '⛔ Only Session Hosts can use this command.', ephemeral: true });
      }

      sessionLink = interaction.options.getString('link');
      const channelId = interaction.options.getString('channel');
      sessionChannel = await client.channels.fetch(channelId).catch(() => null);

      if (!sessionChannel || sessionChannel.type !== 0) {
        return interaction.reply({ content: '⚠️ Invalid channel ID.', ephemeral: true });
      }

      activeSession = true;
      sessionStartTime = Date.now();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('get_link')
          .setLabel('Get Link')
          .setStyle(ButtonStyle.Primary)
      );

      const embed = new EmbedBuilder()
        .setTitle('🎬 RP Session Starting Soon!')
        .setDescription('Session starts in **5 minutes**.\n🔒 Only Public Services and Patreon can access the link right now.\nClick the button below to get access.')
        .setColor(0x00AE86);

      const msg = await sessionChannel.send({ embeds: [embed], components: [row] });

      setTimeout(async () => {
        const everyoneEmbed = new EmbedBuilder()
          .setTitle('🟢 RP Session is Now Open!')
          .setDescription('Everyone can now access the link. Click the button to get it.')
          .setColor(0x00FF00);

        await msg.edit({ embeds: [everyoneEmbed] });
        activeSession = null;
      }, 5 * 60 * 1000);

      return interaction.reply({ content: '✅ Session scheduled.', ephemeral: true });
    }
  }

  // Button interaction: get_link
  if (interaction.isButton()) {
    if (interaction.customId === 'get_link') {
      const now = Date.now();
      const within5Min = sessionStartTime && (now - sessionStartTime < 5 * 60 * 1000);
      const roles = interaction.member.roles.cache.map(r => r.name);
      const hasPublicRole = ['Fire & Rescue', 'Law Enforcement', 'DOT'].some(role => roles.includes(role));
      const isPatreon = roles.includes('Patreon');

      if (within5Min && !isPatreon) {
        const hasStartedShift = shiftStatus.get(interaction.user.id);
        if (!hasStartedShift || !roles.includes(hasStartedShift)) {
          return interaction.reply({ content: '⛔ You must run `/shift start` first with the correct role to join early.', ephemeral: true });
        }
      }

      return interaction.reply({
        content: `🔗 Roblox Server Link: ${sessionLink}`,
        ephemeral: true
      });
    }
  }
});

client.login(process.env.TOKEN);

const { Client, GatewayIntentBits, Partials, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel]
});

let activeSession = false;
let sessionLink = null;
let sessionStartTime = null;
const sessionChannelId = '1391712465364193323'; // canalul unde trimite automat mesajul
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
        return interaction.reply({ content: `⛔ You don't have the role to start a shift as ${requiredRole}.`, ephemeral: true });
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
      sessionStartTime = Date.now();
      activeSession = true;

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

      const sessionChannel = await client.channels.fetch(sessionChannelId).catch(() => null);
      if (!sessionChannel?.isTextBased?.()) {
        return interaction.reply({ content: '⚠️ Cannot post session in the specified channel.', ephemeral: true });
      }

      const msg = await sessionChannel.send({ embeds: [embed], components: [row] });

      setTimeout(async () => {
        const everyoneEmbed = new EmbedBuilder()
          .setTitle('🟢 RP Session is Now Open!')
          .setDescription('Everyone can now access the link. Click the button below to get it.')
          .setColor(0x00FF00);
        await msg.edit({ embeds: [everyoneEmbed] });
        activeSession = false;
      }, 5 * 60 * 1000);

      return interaction.reply({ content: '✅ Session started and announcement posted.', ephemeral: true });
    }
  }

  // Handle button interaction
  if (interaction.isButton() && interaction.customId === 'get_link') {
    const now = Date.now();
    const within5Min = activeSession && (now - sessionStartTime < 5 * 60 * 1000);
    const roles = interaction.member.roles.cache.map(r => r.name);
    const hasPublicRole = ['Fire & Rescue', 'Law Enforcement', 'DOT'].some(role => roles.includes(role));
    const isPatreon = roles.includes('Patreon');

    if (within5Min && !isPatreon) {
      const startedShiftAs = shiftStatus.get(interaction.user.id);
      if (!startedShiftAs || !roles.includes(startedShiftAs)) {
        return interaction.reply({ content: '⛔ You must use `/shift start` with your correct department role before joining.', ephemeral: true });
      }
    }

    return interaction.reply({
      content: `🔗 Roblox Server Link: ${sessionLink}`,
      ephemeral: true
    });
  }
});

client.login(process.env.TOKEN);

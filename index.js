require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.User, Partials.GuildMember]
});

// === CONFIG ===
const SESSION_CHANNEL_ID = '1391712465364193323'; // sesiuni
const PS_RADIO_CHANNEL_ID = '1391845254298210304'; // ps-radio
const PS_ROLES = ['Fire & Rescue', 'Law Enforcement', 'DOT'];
const SESSION_HOST_ROLE = 'Session Host';

let currentSession = null;

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// === COMENZI ===
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const { commandName, options, member, guild } = interaction;

  // ====== SHIFT ======
  if (commandName === 'shift') {
    const sub = options.getSubcommand();
    const department = options.getString('department');
    const roleName =
      department === 'fd' ? 'Fire & Rescue' :
      department === 'le' ? 'Law Enforcement' :
      department === 'dot' ? 'DOT' : null;

    if (!roleName)
      return interaction.reply({ content: '❌ Invalid department.', ephemeral: true });

    if (!member.roles.cache.some(r => r.name === roleName)) {
      return interaction.reply({
        content: `🚫 You don't have the **${roleName}** role.`,
        ephemeral: true
      });
    }

    if (sub === 'start') {
      return interaction.reply({
        content: `✅ You started your shift as **${roleName}**.\nStay alert and serve with pride! 🚓🚒🚧`,
        ephemeral: true
      });
    }

    if (sub === 'end') {
      return interaction.reply({
        content: `🛑 Shift ended. Great work today, **${member.displayName}**! 💼`,
        ephemeral: true
      });
    }
  }

  // ====== SESSION ======
  if (commandName === 'session') {
    const sub = options.getSubcommand();

    if (sub === 'start') {
      // doar Session Host poate folosi
      if (!member.roles.cache.some(r => r.name === SESSION_HOST_ROLE)) {
        return interaction.reply({
          content: '❌ Only **Session Hosts** can start a session.',
          ephemeral: true
        });
      }

      const link = options.getString('link');
      const sessionChannel = client.channels.cache.get(SESSION_CHANNEL_ID);
      if (!sessionChannel)
        return interaction.reply({ content: '⚠️ Session channel not found.', ephemeral: true });

      // mesaj principal
      const embed = new EmbedBuilder()
        .setTitle('🚨 New Roleplay Session Incoming!')
        .setDescription(
          `**Prepare your units and vehicles!**\n\n` +
          `🕐 **Public Services (FD, LE, DOT)** can join immediately.\n` +
          `⏳ **Civilians** will gain access in **5 minutes**.\n\n` +
          `🎮 **Private Server:** Access available soon.`
        )
        .setColor('Red')
        .setTimestamp()
        .setFooter({ text: 'EUGVRP Session System', iconURL: guild.iconURL() });

      const button = new ButtonBuilder()
        .setLabel('Join Session 🚘')
        .setStyle(ButtonStyle.Link)
        .setURL(link);

      const row = new ActionRowBuilder().addComponents(button);

      await sessionChannel.send({ embeds: [embed], components: [row] });
      currentSession = true;

      // anunț pentru civili
      const civilMsg = await sessionChannel.send({
        content: '⚠️ **Civilians cannot join yet.** Please wait **5 minutes.** ⏳'
      });

      setTimeout(async () => {
        await civilMsg.delete().catch(() => {});
        const openEmbed = new EmbedBuilder()
          .setTitle('✅ Session is now open for all!')
          .setDescription('Civilians can now join! Drive safe and enjoy your RP! 🚗💨')
          .setColor('Green');
        await sessionChannel.send({ embeds: [openEmbed], components: [row] });
      }, 5 * 60 * 1000);

      interaction.reply({ content: '✅ Session started successfully.', ephemeral: true });
    }

    if (sub === 'end') {
      if (!currentSession)
        return interaction.reply({ content: '⚠️ No active session found.', ephemeral: true });

      const sessionChannel = client.channels.cache.get(SESSION_CHANNEL_ID);
      const radioChannel = client.channels.cache.get(PS_RADIO_CHANNEL_ID);

      const endEmbed = new EmbedBuilder()
        .setTitle('🛑 Session Ended')
        .setDescription(
          `The session has **officially ended.**\n\n` +
          `All shifts for **FD 🚒**, **LE 🚓**, and **DOT 🚧** have been stopped.\n\n` +
          `💙 Thank you all for participating and roleplaying responsibly!`
        )
        .setColor('DarkRed')
        .setTimestamp()
        .setFooter({ text: 'EUGVRP | Session Closed' });

      await sessionChannel.send({ embeds: [endEmbed] });

      // trimite și în canalul ps-radio
      if (radioChannel) {
        const radioEmbed = new EmbedBuilder()
          .setTitle('📻 Radio Update')
          .setDescription('🔴 **The current RP session has ended.**\nAll public service units are now off-duty.')
          .setColor('Red')
          .setTimestamp();
        await radioChannel.send({ embeds: [radioEmbed] });
      }

      currentSession = null;
      interaction.reply({ content: '✅ Session ended and all shifts have been stopped.', ephemeral: true });
    }
  }

  // ====== TICKET ======
  if (commandName === 'ticket') {
    const target = options.getUser('user');
    const reason = options.getString('reason');
    const proof = options.getString('proof');

    const embed = new EmbedBuilder()
      .setTitle('📋 New Ticket')
      .setColor('Orange')
      .setDescription(`**User:** ${target}\n**Reason:** ${reason}${proof ? `\n**Proof:** ${proof}` : ''}`)
      .setTimestamp();

    await target.send({ content: '📩 You have received a ticket.', embeds: [embed] }).catch(() => {});
    interaction.reply({ content: `✅ Ticket sent to ${target.tag}.`, ephemeral: true });
  }

  // ====== LOG ======
  if (commandName === 'log') {
    const target = options.getUser('user');
    const reason = options.getString('reason');

    const embed = new EmbedBuilder()
      .setTitle('⚠️ User Log')
      .setColor('Yellow')
      .setDescription(`**User:** ${target}\n**Reason:** ${reason}`)
      .setTimestamp();

    interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

client.login(process.env.TOKEN);

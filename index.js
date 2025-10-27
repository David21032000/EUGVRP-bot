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

// === CONFIG - modifică ID-urile dacă e nevoie
const SESSION_CHANNEL_ID = '1391712465364193323';   // canal sesiuni
const PS_RADIO_CHANNEL_ID = '1391845254298210304';  // ps-radio
const SESSION_HOST_ROLE = 'Session Host';
const PATREON_ROLE = 'Patreon';
const PS_ROLE_NAMES = ['Fire & Rescue', 'Law Enforcement', 'DOT']; // numele rolurilor public service

// === INIT CLIENT
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
  partials: [Partials.User, Partials.GuildMember]
});

// === RUNTIME STATE (no DB - in memory)
let currentSession = null;
// currentSession = {
//   messageId: '...', channelId: '...', link: 'https://...', startTimestamp: 1234567890
// }

const activeShifts = new Map(); // userId -> { department: 'Fire & Rescue', startedAt: number }

// === UTIL
function userHasAnyPSRole(member) {
  return PS_ROLE_NAMES.some(name => member.roles.cache.some(r => r.name === name));
}
function userIsPatreon(member) {
  return member.roles.cache.some(r => r.name === PATREON_ROLE);
}
function userIsSessionHost(member) {
  return member.roles.cache.some(r => r.name === SESSION_HOST_ROLE);
}

// === READY
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// === INTERACTION (commands + buttons)
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // ---------- button interaction (Join Session) ----------
    if (interaction.isButton()) {
      // customId expected: 'join_session'
      if (!interaction.customId || !interaction.customId.startsWith('join_session')) {
        return;
      }

      // must have an active session
      if (!currentSession || !currentSession.messageId) {
        return interaction.reply({ content: '⚠️ There is no active session right now.', ephemeral: true });
      }

      // ensure the button belongs to current session message
      if (interaction.message && interaction.message.id !== currentSession.messageId) {
        // old message button clicked — ignore with polite message
        return interaction.reply({ content: '⚠️ This session message is outdated.', ephemeral: true });
      }

      const member = interaction.member;
      const now = Date.now();
      const fiveMinMs = 5 * 60 * 1000;
      const allowedEarly = userHasAnyPSRole(member) || userIsSessionHost(member) || userIsPatreon(member);

      if (allowedEarly) {
        // allowed immediately
        return interaction.reply({ content: `🔓 Access granted. Here is the link: ${currentSession.link}`, ephemeral: true });
      }

      // civilians: check time
      const elapsed = now - currentSession.startTimestamp;
      if (elapsed >= fiveMinMs) {
        return interaction.reply({ content: `🔓 Civilians now allowed — here is the link: ${currentSession.link}`, ephemeral: true });
      } else {
        const remainingSec = Math.ceil((fiveMinMs - elapsed) / 1000);
        return interaction.reply({ content: `⏳ Civilians can join in ${remainingSec} seconds. Please wait a bit.`, ephemeral: true });
      }
    }

    // ---------- chat input commands ----------
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    // ---------- SHIFT
    if (commandName === 'shift') {
      const sub = interaction.options.getSubcommand();
      const deptCode = interaction.options.getString('department');
      const roleName = deptCode === 'fd' ? 'Fire & Rescue' : deptCode === 'le' ? 'Law Enforcement' : deptCode === 'dot' ? 'DOT' : null;

      if (!roleName) {
        return interaction.reply({ content: '❌ Invalid department selected.', ephemeral: true });
      }

      const member = interaction.member;

      // check role
      if (!member.roles.cache.some(r => r.name === roleName)) {
        return interaction.reply({ content: `🚫 You don't have the **${roleName}** role.`, ephemeral: true });
      }

      if (sub === 'start') {
        if (activeShifts.has(member.id)) {
          const cur = activeShifts.get(member.id);
          return interaction.reply({ content: `⚠️ You already have an active shift as **${cur.department}** (started <t:${Math.floor(cur.startedAt/1000)}:R>).`, ephemeral: true });
        }

        activeShifts.set(member.id, { department: roleName, startedAt: Date.now() });
        return interaction.reply({ content: `🟢 Shift started as **${roleName}**. Stay safe out there! ${roleName === 'Fire & Rescue' ? '🚒' : roleName === 'Law Enforcement' ? '🚓' : '🚧'}`, ephemeral: true });
      }

      if (sub === 'end') {
        if (!activeShifts.has(member.id)) {
          return interaction.reply({ content: `⚠️ You have no active shift to end. Use /shift start first.`, ephemeral: true });
        }

        const data = activeShifts.get(member.id);
        activeShifts.delete(member.id);
        const durationMs = Date.now() - data.startedAt;
        const minutes = Math.round(durationMs / 60000);
        return interaction.reply({ content: `🔴 Shift ended for **${data.department}**. Duration: ${minutes} minute(s). Good job!`, ephemeral: true });
      }
    }

    // ---------- SESSION
    if (commandName === 'session') {
      const sub = interaction.options.getSubcommand();

      // SESSION START
      if (sub === 'start') {
        // only Session Host
        if (!userIsSessionHost(interaction.member)) {
          return interaction.reply({ content: '❌ Only Session Hosts can start sessions.', ephemeral: true });
        }

        // prevent double start
        if (currentSession) {
          return interaction.reply({ content: '⚠️ There is already an active session. End it first with /session end.', ephemeral: true });
        }

        const link = interaction.options.getString('link');
        const sessionChannel = await interaction.guild.channels.fetch(SESSION_CHANNEL_ID).catch(() => null);
        if (!sessionChannel) return interaction.reply({ content: '⚠️ Session channel not found. Contact an admin.', ephemeral: true });

        // create embed (no raw link visible to everyone)
        const embed = new EmbedBuilder()
          .setTitle('🚨 New Roleplay Session Incoming!')
          .setDescription(
            `**Started by:** ${interaction.member.displayName}\n\n` +
            `🔹 **Public Services (FD, LE, DOT)** & **Patreon** may join **now** via the Join button.\n` +
            `⏳ **Civilians** will be allowed in **5 minutes** (the Join button will grant access after that).\n\n` +
            `🎮 Click the button below to request the session link.`
          )
          .setColor(0xE74C3C)
          .setTimestamp()
          .setFooter({ text: 'EUGVRP Session System', iconURL: interaction.guild.iconURL() || undefined });

        // custom button (not link) -> bot will give link via ephemeral if allowed
        const joinButton = new ButtonBuilder()
          .setCustomId('join_session')
          .setLabel('Request Join Link 🔗')
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(joinButton);

        const sent = await sessionChannel.send({ embeds: [embed], components: [row] });
        // save current session
        currentSession = {
          messageId: sent.id,
          channelId: sessionChannel.id,
          link,
          startTimestamp: Date.now()
        };

        // send PS-radio announcement
        const radioChannel = await interaction.guild.channels.fetch(PS_RADIO_CHANNEL_ID).catch(() => null);
        if (radioChannel) {
          const radioEmbed = new EmbedBuilder()
            .setTitle('📢 Session Started')
            .setDescription(`**${interaction.member.displayName}** started a session.\nFD, LE, DOT & Patreon may join now. Civilians in 5 minutes.`)
            .setColor(0x1ABC9C)
            .setTimestamp();
          await radioChannel.send({ embeds: [radioEmbed] }).catch(() => {});
        }

        await interaction.reply({ content: '✅ Session started successfully.', ephemeral: true });
        return;
      }

      // SESSION END
      if (sub === 'end') {
        // only Session Host
        if (!userIsSessionHost(interaction.member)) {
          return interaction.reply({ content: '❌ Only Session Hosts can end sessions.', ephemeral: true });
        }

        if (!currentSession) {
          return interaction.reply({ content: '⚠️ There is no active session to end.', ephemeral: true });
        }

        // fetch channel & message and delete message
        const sessionChannel = await interaction.guild.channels.fetch(currentSession.channelId).catch(() => null);
        if (sessionChannel) {
          const msg = await sessionChannel.messages.fetch(currentSession.messageId).catch(() => null);
          if (msg) {
            await msg.delete().catch(() => {});
          }
        }

        // Build nice end embed and PS-radio embed, include ended shifts count and names
        const endedList = [];
        for (const [userId, info] of activeShifts.entries()) {
          // try to fetch member username (best-effort)
          const m = await interaction.guild.members.fetch(userId).catch(() => null);
          endedList.push(m ? `${m.displayName} (${info.department})` : `${userId} (${info.department})`);
        }
        const endedCount = endedList.length;

        // clear active shifts
        activeShifts.clear();

        const endEmbed = new EmbedBuilder()
          .setTitle('🛑 Session Ended — All units stand down')
          .setDescription(
            `The session started by **${interaction.member.displayName}** has concluded.\n\n` +
            `🔻 **All active shifts for FD, LE & DOT have been stopped automatically.**\n` +
            `📌 **Shifts ended:** ${endedCount}\n` +
            (endedCount > 0 ? `\n👥 ${endedList.slice(0, 25).join('\n')}` : '\nNo active shifts were found.')
          )
          .setColor(0x8B0000)
          .setTimestamp()
          .setFooter({ text: 'EUGVRP | Session Closed' });

        // send to session channel
        if (sessionChannel) {
          await sessionChannel.send({ embeds: [endEmbed] }).catch(() => {});
        }

        // send to PS Radio channel
        const radioChannel = await interaction.guild.channels.fetch(PS_RADIO_CHANNEL_ID).catch(() => null);
        if (radioChannel) {
          const radioEmbed = new EmbedBuilder()
            .setTitle('📻 Radio Update: Session Concluded')
            .setDescription('🔴 The current RP session has ended. All PS units are now off-duty.')
            .setColor(0xE74C3C)
            .setTimestamp();
          await radioChannel.send({ embeds: [radioEmbed] }).catch(() => {});
        }

        // clear currentSession
        currentSession = null;
        return interaction.reply({ content: '✅ Session ended: all shifts stopped and announcements sent.', ephemeral: true });
      }
    }

    // ---------- TICKET ----------
    if (commandName === 'ticket') {
      const target = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason');
      const proof = interaction.options.getString('proof');

      const embed = new EmbedBuilder()
        .setTitle('📋 New Ticket')
        .setColor(0xE67E22)
        .setDescription(`**User:** ${target.tag}\n**Reason:** ${reason}${proof ? `\n**Proof:** ${proof}` : ''}`)
        .setTimestamp();

      // DM user best-effort
      await target.send({ content: '📩 You have received a ticket.', embeds: [embed] }).catch(() => {});
      return interaction.reply({ content: `✅ Ticket sent to ${target.tag}.`, ephemeral: true });
    }

    // ---------- LOG ----------
    if (commandName === 'log') {
      const target = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason');

      const embed = new EmbedBuilder()
        .setTitle('⚠️ User Log')
        .setColor(0xF1C40F)
        .setDescription(`**User:** ${target.tag}\n**Reason:** ${reason}`)
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

  } catch (err) {
    console.error('Interaction handler error:', err);
    if (interaction && !interaction.replied) {
      try { await interaction.reply({ content: '❌ An error occurred while processing your request.', ephemeral: true }); } catch {}
    }
  }
});

// === Graceful shutdown (optional) ===
// process.on('SIGINT', () => client.destroy()); // uncomment if you like

client.login(process.env.TOKEN);

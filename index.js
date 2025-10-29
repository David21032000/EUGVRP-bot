// index.js - EUGVRP Bot PRO ULTRA (final)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
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

// ---------------------------
// CONFIG (IDs provided by you)
const SESSION_CHANNEL_ID = '1391712465364193323';   // sessions channel
const PS_RADIO_CHANNEL_ID = '1391845254298210304';  // ps-radio channel
const GENERAL_CHANNEL_ID = '1391843098505515181';   // general channel for car posts

const ROLE_IDS = {
  SESSION_HOST: '1392137660117549056',
  PATREON: '1392139021295292436',
  LE: '1392135802053722222',
  FD: '1392137836412665948',
  DOT: '1392138933336543252',
  CIVILIAN: '1392137321846935712'
};
// ---------------------------

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages],
  partials: [Partials.User, Partials.GuildMember]
});

// Runtime state (no DB)
let currentSession = null; // { messageId, channelId, link, startTimestamp, hostId }
const activeShifts = new Map(); // userId -> { departmentCode, departmentName, startedAt }

// Cars storage (persisted to cars.json)
const CARS_FILE = path.join(__dirname, 'cars.json');
let cars = []; // array of { plate, name, model, color, ownerTag, ownerId, registeredAt }
function loadCars() {
  try {
    if (fs.existsSync(CARS_FILE)) {
      const raw = fs.readFileSync(CARS_FILE, 'utf8');
      cars = JSON.parse(raw) || [];
    } else {
      cars = [];
    }
  } catch (err) {
    console.error('Failed to load cars.json:', err);
    cars = [];
  }
}
function saveCars() {
  try {
    fs.writeFileSync(CARS_FILE, JSON.stringify(cars, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save cars.json:', err);
  }
}
loadCars();

// Helpers
const fiveMinutesMs = 5 * 60 * 1000;
function isSessionHost(member) { return member.roles.cache.has(ROLE_IDS.SESSION_HOST); }
function isPatron(member) { return member.roles.cache.has(ROLE_IDS.PATREON); }
function hasFD(member) { return member.roles.cache.has(ROLE_IDS.FD); }
function hasLE(member) { return member.roles.cache.has(ROLE_IDS.LE); }
function hasDOT(member) { return member.roles.cache.has(ROLE_IDS.DOT); }
function isCivilian(member) {
  if (member.roles.cache.has(ROLE_IDS.CIVILIAN)) return true;
  return !(hasFD(member) || hasLE(member) || hasDOT(member) || isPatron(member) || isSessionHost(member));
}
function departmentFromCode(code) {
  if (code === 'fd') return { name: 'Fire & Rescue', emoji: '🚒' };
  if (code === 'le') return { name: 'Law Enforcement', emoji: '🚓' };
  if (code === 'dot') return { name: 'DOT', emoji: '🚧' };
  return null;
}

// Ready
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// Interaction handler (commands + buttons)
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    // ---------- Button interaction: join_session ----------
    if (interaction.isButton()) {
      if (!interaction.customId || !interaction.customId.startsWith('join_session')) return;

      if (!currentSession) {
        return interaction.reply({ content: '⚠️ There is no active session right now.', ephemeral: true });
      }

      // ensure this button belongs to the live session message
      if (interaction.message && interaction.message.id !== currentSession.messageId) {
        return interaction.reply({ content: '⚠️ This session message is outdated.', ephemeral: true });
      }

      const member = interaction.member;
      const now = Date.now();
      const elapsed = now - currentSession.startTimestamp;
      const allowedEarly = hasFD(member) || hasLE(member) || hasDOT(member) || isPatron(member) || isSessionHost(member);

      if (allowedEarly) {
        await interaction.reply({ content: `🔓 Access granted. Here is the session link: ${currentSession.link}`, ephemeral: true });
      } else {
        if (elapsed >= fiveMinutesMs) {
          await interaction.reply({ content: `🔓 Civilians are now allowed. Here is the session link: ${currentSession.link}`, ephemeral: true });
        } else {
          const remainingSec = Math.ceil((fiveMinutesMs - elapsed) / 1000);
          await interaction.reply({ content: `⏳ Civilians can join in ${remainingSec} seconds. Please wait a bit.`, ephemeral: true });
        }
      }
      return;
    }

    // ---------- Chat input commands ----------
    if (!interaction.isChatInputCommand()) return;

    const { commandName, options, member, guild, channelId } = interaction;

    // ---------- /shift ----------
    if (commandName === 'shift') {
      // only allow use in PS_RADIO_CHANNEL
      if (channelId !== PS_RADIO_CHANNEL_ID) {
        return interaction.reply({ content: `❌ You must use /shift commands in the PS-Radio channel.`, ephemeral: true });
      }

      const sub = options.getSubcommand();
      const deptCode = options.getString('department'); // 'fd' | 'le' | 'dot'
      const dept = departmentFromCode(deptCode);
      if (!dept) {
        return interaction.reply({ content: '❌ Invalid department selected.', ephemeral: true });
      }

      if (!currentSession) {
        return interaction.reply({ content: '⚠️ There is no active session right now. You cannot start a shift.', ephemeral: true });
      }

      // Shift start
      if (sub === 'start') {
        const hasRole = (deptCode === 'fd' && hasFD(member)) || (deptCode === 'le' && hasLE(member)) || (deptCode === 'dot' && hasDOT(member));
        if (!hasRole) {
          return interaction.reply({ content: `🚫 You don't have the required role for **${dept.name}**.`, ephemeral: true });
        }

        if (activeShifts.has(member.id)) {
          const s = activeShifts.get(member.id);
          return interaction.reply({
            content: `⚠️ You already have an active shift as **${s.departmentName}** (started <t:${Math.floor(s.startedAt/1000)}:R>).`,
            ephemeral: true
          });
        }

        // civilian rule: must wait 5 minutes after session start
        const now = Date.now();
        const elapsed = now - currentSession.startTimestamp;
        if (isCivilian(member) && elapsed < fiveMinutesMs) {
          const remainingSec = Math.ceil((fiveMinutesMs - elapsed) / 1000);
          return interaction.reply({ content: `⏳ Civilians can start shifts in ${remainingSec} seconds. Please wait.`, ephemeral: true });
        }

        activeShifts.set(member.id, {
          departmentCode: deptCode,
          departmentName: dept.name,
          startedAt: Date.now()
        });

        await interaction.reply({ content: `🟢 You have started your shift as **${dept.name}**. Stay safe and follow RP rules! ${dept.emoji}`, ephemeral: true });

        // DM to user
        try { await member.send(`✅ You have successfully started your shift as **${dept.name}**.`).catch(()=>{}); } catch {}

        // DM to session host
        if (currentSession && currentSession.hostId) {
          try {
            const hostMember = await guild.members.fetch(currentSession.hostId).catch(()=>null);
            if (hostMember) await hostMember.send(`👮 ${member.user.tag} has started their shift as **${dept.name}**.`).catch(()=>{});
          } catch (err) {}
        }

        // PS-RADIO announcement
        try {
          const radio = await guild.channels.fetch(PS_RADIO_CHANNEL_ID).catch(()=>null);
          if (radio) await radio.send({ content: `🚨 **${member.displayName}** is now on duty as **${dept.name}** ${dept.emoji}` }).catch(()=>{});
        } catch (err) {}
        return;
      }

      // Shift end
      if (sub === 'end') {
        if (!activeShifts.has(member.id)) {
          return interaction.reply({ content: '⚠️ You have no active shift to end.', ephemeral: true });
        }

        const data = activeShifts.get(member.id);
        activeShifts.delete(member.id);
        const durationMs = Date.now() - data.startedAt;
        const minutes = Math.round(durationMs / 60000);

        await interaction.reply({ content: `🔴 Your shift as **${data.departmentName}** has ended. Duration: ${minutes} minute(s). Thank you!`, ephemeral: true });

        try { await member.send(`🛑 Your shift as **${data.departmentName}** has ended. Duration: ${minutes} minute(s). Thank you for your service.`).catch(()=>{}); } catch {}

        // Notify session host
        if (currentSession && currentSession.hostId) {
          try {
            const hostMember = await guild.members.fetch(currentSession.hostId).catch(()=>null);
            if (hostMember) await hostMember.send(`📌 ${member.user.tag} has ended their shift as **${data.departmentName}**.`).catch(()=>{});
          } catch (err) {}
        }

        // PS-RADIO announcement
        try {
          const radio = await guild.channels.fetch(PS_RADIO_CHANNEL_ID).catch(()=>null);
          if (radio) await radio.send({ content: `📻 **${member.displayName}** has ended their shift as **${data.departmentName}**.` }).catch(()=>{});
        } catch (err) {}
        return;
      }
    } // end /shift

    // ---------- /session ----------
    if (commandName === 'session') {
      const sub = options.getSubcommand();

      // SESSION START
      if (sub === 'start') {
        if (!isSessionHost(member)) return interaction.reply({ content: '❌ Only Session Hosts can start a session.', ephemeral: true });
        if (currentSession) return interaction.reply({ content: '⚠️ There is already an active session. End it first with /session end.', ephemeral: true });

        const link = options.getString('link');
        const sessionChannel = await guild.channels.fetch(SESSION_CHANNEL_ID).catch(()=>null);
        if (!sessionChannel) return interaction.reply({ content: '⚠️ Session channel not found. Contact an admin.', ephemeral: true });

        const embed = new EmbedBuilder()
          .setTitle('🚨 New Roleplay Session Started!')
          .setDescription(`**Host:** ${member.displayName}\n\n🔹 Public Services (FD, LE, DOT) & Patrons may join now by clicking the button below.\n⏳ Civilians will be allowed in 5 minutes.\n\n🎮 Click the button to request the session link.`)
          .setColor(0xE74C3C)
          .setTimestamp()
          .setFooter({ text: 'EUGVRP Session System', iconURL: guild.iconURL() || undefined });

        const joinButton = new ButtonBuilder()
          .setCustomId('join_session')
          .setLabel('Request Join Link 🔗')
          .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(joinButton);
        const sentMessage = await sessionChannel.send({ embeds: [embed], components: [row] });

        currentSession = {
          messageId: sentMessage.id,
          channelId: sessionChannel.id,
          link,
          startTimestamp: Date.now(),
          hostId: member.id
        };

        // PS-Radio announcement
        try {
          const radio = await guild.channels.fetch(PS_RADIO_CHANNEL_ID).catch(()=>null);
          if (radio) {
            const radioEmbed = new EmbedBuilder()
              .setTitle('📢 Session Started')
              .setDescription(`${member.displayName} started a session.\nFD, LE, DOT & Patrons may join now. Civilians in 5 minutes.`)
              .setColor(0x1ABC9C)
              .setTimestamp();
            await radio.send({ embeds: [radioEmbed] }).catch(()=>{});
          }
        } catch (err) {}

        // DM to session host
        try { await member.send(`✅ Your session has been started successfully. Players can now begin their shifts.`).catch(()=>{}); } catch {}

        await interaction.reply({ content: '✅ Session started successfully.', ephemeral: true });
        return;
      }

      // SESSION END
      if (sub === 'end') {
        if (!isSessionHost(member)) return interaction.reply({ content: '❌ Only Session Hosts can end sessions.', ephemeral: true });
        if (!currentSession) return interaction.reply({ content: '⚠️ There is no active session to end.', ephemeral: true });

        const sessionChannel = await guild.channels.fetch(currentSession.channelId).catch(()=>null);
        if (sessionChannel) {
          const msg = await sessionChannel.messages.fetch(currentSession.messageId).catch(()=>null);
          if (msg) await msg.delete().catch(()=>{});
        }

        // Prepare ended shifts list
        const endedList = [];
        for (const [userId, info] of activeShifts.entries()) {
          const mem = await guild.members.fetch(userId).catch(()=>null);
          const display = mem ? `${mem.user.tag} — ${info.departmentName}` : `${userId} — ${info.departmentName}`;
          endedList.push(display);
        }
        const endedCount = endedList.length;

        // DM each user who had an active shift
        for (const [userId, info] of activeShifts.entries()) {
          try {
            const mem = await guild.members.fetch(userId).catch(()=>null);
            if (mem) await mem.send(`⚠️ The session has ended. Your shift as **${info.departmentName}** has been automatically closed.`).catch(()=>{});
          } catch (err) {}
        }

        // Clear all active shifts
        activeShifts.clear();

        // Session end embed for session channel
        const endEmbed = new EmbedBuilder()
          .setTitle('🛑 Session Ended — All units stand down')
          .setDescription(`The session started by **${member.displayName}** has concluded.\n\n🔻 All active shifts for FD, LE & DOT have been stopped automatically.\n\n📌 Shifts ended: **${endedCount}**${endedCount > 0 ? `\n\n${endedList.slice(0,25).join('\n')}` : '\n\nNo active shifts were found.'}`)
          .setColor(0x8B0000)
          .setTimestamp()
          .setFooter({ text: 'EUGVRP | Session Closed' });

        if (sessionChannel) await sessionChannel.send({ embeds: [endEmbed] }).catch(()=>{});

        // PS-Radio embed (shorter)
        try {
          const radio = await guild.channels.fetch(PS_RADIO_CHANNEL_ID).catch(()=>null);
          if (radio) {
            const radioEmbed = new EmbedBuilder()
              .setTitle('📻 Radio Update: Session Concluded')
              .setDescription('🔴 The current RP session has ended. All public service units are now off-duty.')
              .setColor(0xE74C3C)
              .setTimestamp();
            await radio.send({ embeds: [radioEmbed] }).catch(()=>{});
          }
        } catch (err) {}

        // DM summary to session host
        try {
          await member.send(`📋 The session has ended. ${endedCount} shift(s) were closed.\n${endedCount > 0 ? `Closed shifts:\n- ${endedList.join('\n- ')}` : 'No shifts were active during this session.'}`).catch(()=>{});
        } catch (err) {}

        // clear current session
        currentSession = null;
        return interaction.reply({ content: '✅ Session ended: all shifts stopped and announcements sent.', ephemeral: true });
      }
    } // end /session

    // ---------- /car ----------
    if (commandName === 'car') {
      const sub = options.getSubcommand();

      // /car add
      if (sub === 'add') {
        const name = options.getString('name').trim();
        const model = options.getString('model').trim();
        const color = options.getString('color').trim();
        const plate = options.getString('plate').trim().toUpperCase();

        if (!name || !model || !color || !plate) {
          return interaction.reply({ content: '❌ All fields are required: name, model, color, plate.', ephemeral: true });
        }

        if (cars.some(c => c.plate === plate)) {
          return interaction.reply({ content: `❌ A car with plate **${plate}** is already registered.`, ephemeral: true });
        }

        const car = {
          plate,
          name,
          model,
          color,
          ownerTag: interaction.user.tag,
          ownerId: interaction.user.id,
          registeredAt: Date.now()
        };
        cars.push(car);
        saveCars();

        // DM to registrant
        try { await interaction.user.send(`✅ Your vehicle **${name}** (${model}, ${color}) with plate **${plate}** has been registered.`).catch(()=>{}); } catch {}

        // Post in GENERAL channel (instead of ps-radio)
        try {
          const general = await guild.channels.fetch(GENERAL_CHANNEL_ID).catch(()=>null);
          if (general) {
            const carEmbed = new EmbedBuilder()
              .setTitle('🚗 New Vehicle Registered')
              .setDescription(`**Owner:** ${interaction.user.tag}\n**Name:** ${name}\n**Model:** ${model}\n**Color:** ${color}\n**Plate:** **${plate}**`)
              .setColor(0x3498DB)
              .setTimestamp();
            await general.send({ embeds: [carEmbed] }).catch(()=>{});
          }
        } catch (err) {}

        return interaction.reply({ content: `✅ Vehicle registered: **${name}** (${model}) — plate **${plate}**`, ephemeral: true });
      }

      // /car list
      if (sub === 'list') {
        if (cars.length === 0) return interaction.reply({ content: 'ℹ️ No vehicles are registered yet.', ephemeral: true });

        const lines = cars.map(c => `**${c.plate}** — ${c.name} (${c.model}) • ${c.color} — ${c.ownerTag}`);
        // create embeds limited to Discord max sizes (rough simple chunker)
        const chunks = [];
        let current = [];
        let currentLen = 0;
        for (const line of lines) {
          if (currentLen + line.length + 1 > 1800) {
            chunks.push(current.join('\n'));
            current = [line];
            currentLen = line.length;
          } else {
            current.push(line);
            currentLen += line.length + 1;
          }
        }
        if (current.length) chunks.push(current.join('\n'));

        // send paginated-ish ephemeral replies (if multiple chunks, send multiple ephemeral messages)
        for (let i = 0; i < chunks.length; i++) {
          const embed = new EmbedBuilder()
            .setTitle(`📚 Registered Vehicles${chunks.length > 1 ? ` (page ${i+1}/${chunks.length})` : ''}`)
            .setDescription(chunks[i])
            .setColor(0x2ECC71)
            .setTimestamp();
          if (i === 0) {
            await interaction.reply({ embeds: [embed], ephemeral: true });
          } else {
            // followups for further pages
            await interaction.followUp({ embeds: [embed], ephemeral: true });
          }
        }
        return;
      }

      // /car remove
      if (sub === 'remove') {
        const plateRaw = options.getString('plate').trim().toUpperCase();
        const idx = cars.findIndex(c => c.plate === plateRaw);
        if (idx === -1) {
          return interaction.reply({ content: `❌ No vehicle found with plate **${plateRaw}**.`, ephemeral: true });
        }
        const removed = cars.splice(idx, 1)[0];
        saveCars();

        // DM to remover
        try { await interaction.user.send(`✅ Vehicle with plate **${plateRaw}** has been removed from registry.`).catch(()=>{}); } catch {}

        // Notify general channel that a car was removed
        try {
          const general = await guild.channels.fetch(GENERAL_CHANNEL_ID).catch(()=>null);
          if (general) {
            const embed = new EmbedBuilder()
              .setTitle('🗑️ Vehicle Removed')
              .setDescription(`**Plate:** ${removed.plate}\n**Name:** ${removed.name}\n**Removed by:** ${interaction.user.tag}`)
              .setColor(0xE74C3C)
              .setTimestamp();
            await general.send({ embeds: [embed] }).catch(()=>{});
          }
        } catch (err) {}

        return interaction.reply({ content: `✅ Vehicle with plate **${plateRaw}** removed.`, ephemeral: true });
      }
    } // end /car

    // ---------- /ticket ----------
    if (commandName === 'ticket') {
      const target = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason');
      const proof = interaction.options.getString('proof');

      const embed = new EmbedBuilder()
        .setTitle('📋 New Ticket')
        .setColor(0xE67E22)
        .setDescription(`**User:** ${target.tag}\n**Reason:** ${reason}${proof ? `\n**Proof:** ${proof}` : ''}`)
        .setTimestamp();

      try { await target.send({ content: '📩 You have received a ticket.', embeds: [embed] }).catch(()=>{}); } catch {}
      return interaction.reply({ content: `✅ Ticket sent to ${target.tag}.`, ephemeral: true });
    }

    // ---------- /log ----------
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

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down gracefully...');
  client.destroy();
  process.exit();
});

client.login(process.env.TOKEN);

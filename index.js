const {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const dotenv = require('dotenv');
const { Pool } = require('pg');
dotenv.config();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const psChannelId = '1391845254298210304';
const sessionChannelId = '1391712465364193323';

const shiftStatus = new Map();
let activeSession = false;
let sessionLink, sessionStartTime, sessionMessage;

client.once(Events.ClientReady, () => {
  console.log(`✅ Bot online as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async inter => {
  if (!inter.isChatInputCommand()) return;
  const cmd = inter.commandName;

  // --- SHIFT START ---
  if (cmd === 'shift') {
    const dept = inter.options.getString('department');
    const map = { fire:'Fire & Rescue', police:'Law Enforcement', dot:'DOT' };
    const roleName = map[dept];
    const member = await inter.guild.members.fetch(inter.user.id);
    if (!member.roles.cache.some(r=>r.name===roleName)) {
      return inter.reply({ content:`⛔ No permission for ${roleName}.`, ephemeral:true });
    }
    shiftStatus.set(inter.user.id, roleName);
    const psChannel = await client.channels.fetch(psChannelId).catch(()=>null);
    if (psChannel) await psChannel.send(`✅ ${inter.user} started shift as ${roleName}.`);
    return inter.reply({ content:`Shift started as ${roleName}.`, ephemeral:true });
  }

  // --- SHIFT END ---
  if (cmd === 'shiftend') {
    if (!shiftStatus.has(inter.user.id)) {
      return inter.reply({ content:'ℹ️ You have no active shift.', ephemeral:true });
    }
    const roleName = shiftStatus.get(inter.user.id);
    shiftStatus.delete(inter.user.id);
    const psChannel = await client.channels.fetch(psChannelId).catch(()=>null);
    if (psChannel) await psChannel.send(`🛑 ${inter.user} ended shift from ${roleName}.`);
    return inter.reply({ content:'Shift ended.', ephemeral:true });
  }

  // --- SESSION START ---
  if (cmd === 'session') {
    if (!inter.member.roles.cache.some(r=>r.name==='Session Host')) {
      return inter.reply({ content:'⛔ Only Session Hosts.', ephemeral:true });
    }
    sessionLink = inter.options.getString('link');
    activeSession = true;
    sessionStartTime = Date.now();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('get_link').setLabel('Get Link').setStyle(ButtonStyle.Primary)
    );
    const embed = new EmbedBuilder()
      .setTitle('🎬 Session starts in 5 min')
      .setDescription('🛑 Only Public Services or Patreon can click now.\n🔗 Link will be shared privately.')
      .setColor(0x00AE86);

    const sessCh = await client.channels.fetch(sessionChannelId).catch(()=>null);
    if (!sessCh?.isTextBased?.()) {
      return inter.reply({ content:'⚠️ Cannot access session channel.', ephemeral:true });
    }
    sessionMessage = await sessCh.send({ embeds:[embed], components:[row] });

    setTimeout(async () => {
      const emb2 = new EmbedBuilder()
        .setTitle('🟢 Session open now!')
        .setDescription('Everyone can click the button now for the link.')
        .setColor(0x00FF00);
      if (sessionMessage.editable) await sessionMessage.edit({ embeds:[emb2] });
    }, 5 * 60 * 1000);

    return inter.reply({ content:'Session scheduled.', ephemeral:true });
  }

  // --- SESSION END ---
  if (cmd === 'sessionend') {
    if (!inter.member.roles.cache.some(r=>r.name==='Session Host')) {
      return inter.reply({ content:'⛔ Only Session Hosts.', ephemeral:true });
    }
    if (sessionMessage?.deletable) await sessionMessage.delete().catch(()=>null);
    activeSession = false; sessionLink = null; sessionStartTime = null;
    sessionMessage = null;

    // auto-end shifts
    const psChannel = await client.channels.fetch(psChannelId).catch(()=>null);
    for (const [uid, rn] of shiftStatus.entries()) {
      if (psChannel) await psChannel.send(`🛑 <@${uid}>'s shift (${rn}) auto ended.`);
    }
    shiftStatus.clear();
    return inter.reply({ content:'Session ended & all shifts closed.', ephemeral:true });
  }

  // --- CAR ADD ---
  if (cmd === 'caradd') {
    const name = inter.options.getString('name');
    const color = inter.options.getString('color');
    const plate = inter.options.getString('plate').toUpperCase();

    const member = inter.member;
    const patreon = member.roles.cache.some(r => r.name==='Patreon');
    const { rows:cars } = await pool.query('SELECT * FROM cars WHERE user_id=$1', [inter.user.id]);
    if (!patreon && cars.length >= 5) {
      return inter.reply({ content:'✅ You can own max 5 cars (Patreon max 20).', ephemeral:true });
    }
    if (patreon && cars.length >= 20) {
      return inter.reply({ content:'✅ Patreon max 20 cars.', ephemeral:true });
    }

    await pool.query(
      'INSERT INTO cars(user_id, username, car_name, color, plate) VALUES($1,$2,$3,$4,$5)',
      [inter.user.id, inter.user.tag, name, color, plate]
    );
    return inter.reply({ content:`✅ Car added: ${name} (${color}) plate: ${plate}`, ephemeral:true });
  }

  // --- CAR DELETE ---
  if (cmd === 'cardelete') {
    const plate = inter.options.getString('plate').toUpperCase();
    await pool.query('DELETE FROM cars WHERE user_id=$1 AND plate=$2', [inter.user.id, plate]);
    return inter.reply({ content:`✅ Car plate ${plate} removed if existed.`, ephemeral:true });
  }

  // --- PLATE CHECK ---
  if (cmd === 'plate') {
    const plate = inter.options.getString('plate').toUpperCase();
    const { rows } = await pool.query('SELECT * FROM cars WHERE plate=$1', [plate]);
    if (rows.length === 0) {
      return inter.reply({ content:'🚗 The car is not registered.', ephemeral:true });
    }
    const owner = rows[0].username;
    return inter.reply({ content:`🚗 Registered by: ${owner}`, ephemeral:true });
  }

  // --- PROFILE ---
  if (cmd === 'profile') {
    const { rows:cars } = await pool.query('SELECT * FROM cars WHERE user_id=$1', [inter.user.id]);
    const { rows:ts } = await pool.query('SELECT * FROM tickets WHERE user_id=$1', [inter.user.id]);
    const { rows:ls } = await pool.query('SELECT * FROM logs WHERE user_id=$1', [inter.user.id]);

    const embed = new EmbedBuilder()
      .setTitle(`${inter.user.tag} – Profile`)
      .addFields(
        { name:'🚘 Cars', value: cars.map(c=>`${c.car_name} (${c.color}) plate: ${c.plate}`).join('\n') || 'None' },
        { name:'🎫 Tickets', value: ts.map(t=>`${t.reason}`).join('\n') || 'None' },
        { name:'⚠️ Logs', value: ls.map(l=>`${l.reason}`).join('\n') || 'None' }
      )
      .setColor(0x0099FF);

    if (ls.length >= 3) {
      try { await inter.user.send('⚠️ You are session banned due to 3 or more logs.'); } catch {}
    }
    return inter.reply({ embeds:[embed], ephemeral:true });
  }
});

// --- BUTTON HANDLER ---
client.on(Events.InteractionCreate, async inter => {
  if (!inter.isButton() || inter.customId !== 'get_link') return;

  const now = Date.now();
  const early = activeSession && (now - sessionStartTime < 5 * 60 * 1000);
  const roles = inter.member.roles.cache.map(r=>r.name);
  const pub = ['Fire & Rescue','Law Enforcement','DOT'].some(r=>roles.includes(r));
  const isPat = roles.includes('Patreon');

  if (early && !isPat) {
    const sht = shiftStatus.get(inter.user.id);
    if (!sht || !roles.includes(sht)) {
      return inter.reply({ content:'⛔ Use `/shift start` with correct role.', ephemeral:true });
    }
  }
  return inter.reply({ content:`🔗 Server Link: ${sessionLink}`, ephemeral:true });
});

client.login(process.env.TOKEN);

require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes, Collection, Events } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  partials: [Partials.User, Partials.GuildMember]
});

const SESSION_CHANNEL_ID = '1391712465364193323';
const PS_RADIO_CHANNEL_ID = '1391845254298210304';

const PUBLIC_SERVICES = {
  fd: 'Fire & Rescue',
  le: 'Law Enforcement',
  dot: 'DOT'
};

const PATREON_ROLE = 'Patreon';

let currentSession = null;
client.commands = new Collection();

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, member, guild } = interaction;

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

  } else if (commandName === 'session') {
    const sub = options.getSubcommand();
    if (sub === 'start') {
      const link = options.getString('link');

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Join Session')
          .setStyle(ButtonStyle.Link)
          .setURL(link)
      );

      const message = await client.channels.cache.get(SESSION_CHANNEL_ID)?.send({
        content: `🚨 A session will begin in 5 minutes.\nOnly Public Services and Patreon can join early.`,
        components: [row]
      });

      currentSession = message.id;
      interaction.reply({ content: '✅ Session started.', ephemeral: true });

    } else if (sub === 'end') {
      if (currentSession) {
        const msg = await client.channels.cache.get(SESSION_CHANNEL_ID)?.messages.fetch(currentSession).catch(() => null);
        if (msg) await msg.delete();
        currentSession = null;
        interaction.reply({ content: '🛑 Session ended.', ephemeral: true });
      } else {
        interaction.reply({ content: '⚠️ No active session found.', ephemeral: true });
      }
    }

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

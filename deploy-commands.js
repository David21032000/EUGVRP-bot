require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  // SHIFT
  new SlashCommandBuilder()
    .setName('shift')
    .setDescription('Manage your shift')
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Start your shift')
        .addStringOption(opt =>
          opt.setName('department')
            .setDescription('Select your department')
            .setRequired(true)
            .addChoices(
              { name: 'Fire & Rescue', value: 'fd' },
              { name: 'Law Enforcement', value: 'le' },
              { name: 'Department of Transportation', value: 'dot' }
            )
        )
    )
    .addSubcommand(sub =>
      sub.setName('end').setDescription('End your shift')
    ),

  // SESSION
  new SlashCommandBuilder()
    .setName('session')
    .setDescription('Manage RP sessions')
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Start a new session (Session Host only)')
        .addStringOption(opt =>
          opt.setName('link')
            .setDescription('Private server link')
            .setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('end')
        .setDescription('End the current session (Session Host only)')
    ),

  // TICKET
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Send a ticket to a user')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true))
    .addStringOption(opt => opt.setName('proof').setDescription('Proof link')),

  // LOG
  new SlashCommandBuilder()
    .setName('log')
    .setDescription('Create a log about a user')
    .addUserOption(opt => opt.setName('user').setDescription('User').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true))
]
.map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('📡 Deploying slash commands to guild...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Commands deployed successfully!');
  } catch (error) {
    console.error('❌ Failed to deploy commands:', error);
  }
})();

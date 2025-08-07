require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder().setName('shift').setDescription('Manage shift')
    .addSubcommand(sub => sub.setName('start').setDescription('Start a shift')
      .addStringOption(opt =>
        opt.setName('department').setDescription('Choose department').setRequired(true)
          .addChoices(
            { name: 'FD', value: 'fd' },
            { name: 'LE', value: 'le' },
            { name: 'DOT', value: 'dot' }
          )
      ))
    .addSubcommand(sub => sub.setName('end').setDescription('End your shift')),

  new SlashCommandBuilder().setName('session').setDescription('Manage RP sessions')
    .addSubcommand(sub => sub.setName('start').setDescription('Start a session')
      .addStringOption(opt => opt.setName('link').setDescription('Private server link').setRequired(true)))
    .addSubcommand(sub => sub.setName('end').setDescription('End the current session')),

  new SlashCommandBuilder().setName('ticket').setDescription('Send a ticket')
    .addUserOption(opt => opt.setName('user').setDescription('User to ticket').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true))
    .addStringOption(opt => opt.setName('proof').setDescription('Optional proof')),

  new SlashCommandBuilder().setName('log').setDescription('Log a user')
    .addUserOption(opt => opt.setName('user').setDescription('User to log').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true))
]
.map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('🔄 Deploying slash commands...');
    await rest.put(
      Routes.applicationCommands('YOUR_CLIENT_ID'), // ← înlocuiește cu ID-ul botului tău
      { body: commands }
    );
    console.log('✅ All commands deployed.');
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
})();

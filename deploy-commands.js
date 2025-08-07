require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [

  // /caradd
  new SlashCommandBuilder()
    .setName('caradd')
    .setDescription('Register a new car')
    .addStringOption(opt =>
      opt.setName('name').setDescription('Car name').setRequired(true))
    .addStringOption(opt =>
      opt.setName('color').setDescription('Car color').setRequired(true))
    .addStringOption(opt =>
      opt.setName('plate').setDescription('License plate').setRequired(true)),

  // /cardelete
  new SlashCommandBuilder()
    .setName('cardelete')
    .setDescription('Delete a registered car')
    .addStringOption(opt =>
      opt.setName('plate').setDescription('License plate').setRequired(true)),

  // /plate
  new SlashCommandBuilder()
    .setName('plate')
    .setDescription('Check if a license plate is registered')
    .addStringOption(opt =>
      opt.setName('plate').setDescription('License plate').setRequired(true)),

  // /profile
  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your profile: cars, tickets, and logs'),

  // /ticket
  new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Issue a ticket to a user')
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to ticket').setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for the ticket').setRequired(true))
    .addStringOption(opt =>
      opt.setName('proof').setDescription('Medal.tv link or other proof').setRequired(false)),

  // /ticketdelete
  new SlashCommandBuilder()
    .setName('ticketdelete')
    .setDescription('Delete a ticket by its ID')
    .addIntegerOption(opt =>
      opt.setName('id').setDescription('ID of the ticket to delete').setRequired(true)),

  // /log
  new SlashCommandBuilder()
    .setName('log')
    .setDescription('Log a user for rule violation')
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to log').setRequired(true))
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Reason for the log').setRequired(true)),

  // /shift start & end
  new SlashCommandBuilder()
    .setName('shift')
    .setDescription('Start or end a shift')
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Start a shift')
        .addStringOption(opt =>
          opt.setName('department')
            .setDescription('Your department')
            .addChoices(
              { name: 'Fire & Rescue', value: 'fd' },
              { name: 'Law Enforcement', value: 'le' },
              { name: 'DOT', value: 'dot' }
            )
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('end')
        .setDescription('End your shift')),

  // /session start & end
  new SlashCommandBuilder()
    .setName('session')
    .setDescription('Start or end a roleplay session')
    .addSubcommand(sub =>
      sub.setName('start')
        .setDescription('Start a roleplay session')
        .addStringOption(opt =>
          opt.setName('link')
            .setDescription('Private server link')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('end')
        .setDescription('End the current roleplay session')),

].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('📡 Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ All slash commands registered successfully!');
  } catch (error) {
    console.error('❌ Error registering slash commands:', error);
  }
})();

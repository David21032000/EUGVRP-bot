const { SlashCommandBuilder, REST, Routes } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder()
    .setName('shift')
    .setDescription('Start a shift in your department')
    .addStringOption(option =>
      option.setName('department')
        .setDescription('Choose your department')
        .setRequired(true)
        .addChoices(
          { name: 'Fire', value: 'fire' },
          { name: 'Police', value: 'police' },
          { name: 'DOT', value: 'dot' }
        )
    ),

  new SlashCommandBuilder()
    .setName('shiftend')
    .setDescription('End your shift'),

  new SlashCommandBuilder()
    .setName('session')
    .setDescription('Start a session')
    .addStringOption(option =>
      option.setName('link')
        .setDescription('Private server link')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('sessionend')
    .setDescription('End the current session and close all shifts'),

  new SlashCommandBuilder()
    .setName('caradd')
    .setDescription('Register a new car')
    .addStringOption(option =>
      option.setName('name')
        .setDescription('Car name')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('color')
        .setDescription('Car color')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('plate')
        .setDescription('License plate')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('cardelete')
    .setDescription('Delete a registered car')
    .addStringOption(option =>
      option.setName('plate')
        .setDescription('License plate of the car')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('plate')
    .setDescription('Check if a license plate is registered')
    .addStringOption(option =>
      option.setName('plate')
        .setDescription('License plate to check')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your registered cars, tickets, and logs'),
]
  .map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('🔄 Deploying slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash commands deployed!');
  } catch (error) {
    console.error('❌ Failed to deploy commands:', error);
  }
})();

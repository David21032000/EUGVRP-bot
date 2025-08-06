const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const commands = [
  new SlashCommandBuilder()
    .setName('shift')
    .setDescription('Start a Public Services shift')
    .addStringOption(option =>
      option.setName('department')
        .setDescription('Select your department')
        .setRequired(true)
        .addChoices(
          { name: 'Fire', value: 'fire' },
          { name: 'Police', value: 'police' },
          { name: 'DOT', value: 'dot' },
        )),
  new SlashCommandBuilder()
    .setName('session')
    .setDescription('Start a roleplay session')
    .addStringOption(option =>
      option.setName('link')
        .setDescription('Roblox Private Server link')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('channel')
        .setDescription('Channel ID to post the session')
        .setRequired(true)),
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
  try {
    console.log('🔁 Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash commands registered!');
  } catch (err) {
    console.error(err);
  }
})();

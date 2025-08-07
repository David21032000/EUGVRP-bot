require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder().setName('caradd').setDescription('Register a new car')
    .addStringOption(opt => opt.setName('name').setDescription('Car name').setRequired(true))
    .addStringOption(opt => opt.setName('color').setDescription('Color').setRequired(true))
    .addStringOption(opt => opt.setName('plate').setDescription('License plate').setRequired(true)),

  new SlashCommandBuilder().setName('cardelete').setDescription('Delete a registered car')
    .addStringOption(opt => opt.setName('plate').setDescription('License plate').setRequired(true)),

  new SlashCommandBuilder().setName('plate').setDescription('Check if a plate is registered')
    .addStringOption(opt => opt.setName('plate').setDescription('License plate').setRequired(true)),

  new SlashCommandBuilder().setName('profile').setDescription('Show your profile'),

  new SlashCommandBuilder().setName('ticket').setDescription('Issue a ticket')
    .addUserOption(opt => opt.setName('user').setDescription('User to ticket').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the ticket').setRequired(true))
    .addStringOption(opt => opt.setName('proof').setDescription('Optional proof link').setRequired(false)),

  new SlashCommandBuilder().setName('ticketdelete').setDescription('Delete a ticket')
    .addIntegerOption(opt => opt.setName('id').setDescription('Ticket ID').setRequired(true)),

  new SlashCommandBuilder().setName('log').setDescription('Add a user log')
    .addUserOption(opt => opt.setName('user').setDescription('User to log').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason for the log').setRequired(true)),

  new SlashCommandBuilder().setName('shift').setDescription('Shift system')
    .addSubcommand(sub => sub.setName('start').setDescription('Start a shift')
      .addStringOption(opt => opt.setName('department').setDescription('Select department').setRequired(true)
        .addChoices(
          { name: 'FD', value: 'fd' },
          { name: 'LE', value: 'le' },
          { name: 'DOT', value: 'dot' }
        )))
    .addSubcommand(sub => sub.setName('end').setDescription('End your shift')),

  new SlashCommandBuilder().setName('session').setDescription('Manage session')
    .addSubcommand(sub => s

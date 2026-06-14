const bcrypt = require('bcryptjs');
require('dotenv').config();

const { sequelize, User, Group, GroupMember } = require('../models');

const seedData = async () => {
  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      console.error('❌ DATABASE_URL is missing in .env file!');
      process.exit(1);
    }

    console.log('Connecting and syncing database (force drop)...');
    await sequelize.authenticate();
    await sequelize.sync({ force: true });
    console.log('✅ Connected and synced with database');

    console.log('Creating users...');
    const passwordHash = await bcrypt.hash('password123', 12);

    const aisha = await User.create({
      name: 'Aisha',
      email: 'aisha@flatmates.com',
      passwordHash,
    });

    const rohan = await User.create({
      name: 'Rohan',
      email: 'rohan@flatmates.com',
      passwordHash,
    });

    const priya = await User.create({
      name: 'Priya',
      email: 'priya@flatmates.com',
      passwordHash,
    });

    const meera = await User.create({
      name: 'Meera',
      email: 'meera@flatmates.com',
      passwordHash,
    });

    const sam = await User.create({
      name: 'Sam',
      email: 'sam@flatmates.com',
      passwordHash,
    });

    const dev = await User.create({
      name: 'Dev',
      email: 'dev@flatmates.com',
      passwordHash,
    });

    console.log('✅ Users created.');

    console.log('Creating group...');
    const group = await Group.create({
      name: 'Flat Expenses 2026',
      description: 'Shared expenses for the flat. Meera moved out end of March. Sam moved in mid-April. Dev joined for trip.',
      createdBy: aisha.id,
    });
    console.log('✅ Group created.');

    console.log('Creating group members...');
    // Aisha: active from Jan 1st, 2026
    await GroupMember.create({
      groupId: group.id,
      userId: aisha.id,
      joinDate: new Date('2026-01-01'),
      leaveDate: null,
      addedBy: aisha.id,
    });

    // Rohan: active from Jan 1st, 2026
    await GroupMember.create({
      groupId: group.id,
      userId: rohan.id,
      joinDate: new Date('2026-01-01'),
      leaveDate: null,
      addedBy: aisha.id,
    });

    // Priya: active from Jan 1st, 2026
    await GroupMember.create({
      groupId: group.id,
      userId: priya.id,
      joinDate: new Date('2026-01-01'),
      leaveDate: null,
      addedBy: aisha.id,
    });

    // Meera: active from Jan 1st, 2026 to Mar 31st, 2026
    await GroupMember.create({
      groupId: group.id,
      userId: meera.id,
      joinDate: new Date('2026-01-01'),
      leaveDate: new Date('2026-03-31'),
      addedBy: aisha.id,
    });

    // Sam: active from Apr 15th, 2026
    await GroupMember.create({
      groupId: group.id,
      userId: sam.id,
      joinDate: new Date('2026-04-15'),
      leaveDate: null,
      addedBy: aisha.id,
    });

    // Dev: active from Feb 1st, 2026 to Mar 20th, 2026
    await GroupMember.create({
      groupId: group.id,
      userId: dev.id,
      joinDate: new Date('2026-02-01'),
      leaveDate: new Date('2026-03-20'),
      addedBy: aisha.id,
    });

    console.log('✅ Group members created.');
    console.log('\n==================================================');
    console.log('🎉 Seeding successfully completed!');
    console.log('==================================================');
    console.log('You can now log in using Aisha\'s account to test the system:');
    console.log('Email:    aisha@flatmates.com');
    console.log('Password: password123');
    console.log('Group ID: ' + group.id);
    console.log('==================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedData();

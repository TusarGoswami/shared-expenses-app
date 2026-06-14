const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');
const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const Expense = require('../models/Expense');
const ImportLog = require('../models/ImportLog');

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ MONGO_URI is missing in .env file!');
      process.exit(1);
    }

    console.log('Connecting to database...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Clean existing database records for flatmates to avoid conflicts
    console.log('Cleaning existing seed data...');
    const emails = [
      'aisha@flatmates.com',
      'rohan@flatmates.com',
      'priya@flatmates.com',
      'meera@flatmates.com',
      'sam@flatmates.com',
      'dev@flatmates.com'
    ];
    
    // Find users with these emails
    const existingUsers = await User.find({ email: { $in: emails } });
    const userIds = existingUsers.map(u => u._id);

    // Delete groups created by these users or group memberships
    if (userIds.length > 0) {
      const groups = await Group.find({ createdBy: { $in: userIds } });
      const groupIds = groups.map(g => g._id);

      await GroupMember.deleteMany({ groupId: { $in: groupIds } });
      await Expense.deleteMany({ groupId: { $in: groupIds } });
      await ImportLog.deleteMany({ groupId: { $in: groupIds } });
      await Group.deleteMany({ _id: { $in: groupIds } });
      await User.deleteMany({ _id: { $in: userIds } });
    }

    console.log('Creating users...');
    const passwordHash = await bcrypt.hash('password123', 12);

    const aisha = await User.create({
      name: 'Aisha',
      email: 'aisha@flatmates.com',
      passwordHash
    });

    const rohan = await User.create({
      name: 'Rohan',
      email: 'rohan@flatmates.com',
      passwordHash
    });

    const priya = await User.create({
      name: 'Priya',
      email: 'priya@flatmates.com',
      passwordHash
    });

    const meera = await User.create({
      name: 'Meera',
      email: 'meera@flatmates.com',
      passwordHash
    });

    const sam = await User.create({
      name: 'Sam',
      email: 'sam@flatmates.com',
      passwordHash
    });

    const dev = await User.create({
      name: 'Dev',
      email: 'dev@flatmates.com',
      passwordHash
    });

    console.log('✅ Users created.');

    console.log('Creating group...');
    const group = await Group.create({
      name: 'Flat Expenses 2024',
      description: 'Shared expenses for the flat. Meera moved out end of March. Sam moved in mid-April. Dev joined for a trip in May.',
      createdBy: aisha._id
    });
    console.log('✅ Group created.');

    console.log('Creating group members...');
    // Aisha: active from Jan 1st, 2024
    await GroupMember.create({
      groupId: group._id,
      userId: aisha._id,
      joinDate: new Date('2024-01-01'),
      leaveDate: null,
      addedBy: aisha._id
    });

    // Rohan: active from Jan 1st, 2024
    await GroupMember.create({
      groupId: group._id,
      userId: rohan._id,
      joinDate: new Date('2024-01-01'),
      leaveDate: null,
      addedBy: aisha._id
    });

    // Priya: active from Jan 1st, 2024
    await GroupMember.create({
      groupId: group._id,
      userId: priya._id,
      joinDate: new Date('2024-01-01'),
      leaveDate: null,
      addedBy: aisha._id
    });

    // Meera: active from Jan 1st, 2024 to Mar 31st, 2024
    await GroupMember.create({
      groupId: group._id,
      userId: meera._id,
      joinDate: new Date('2024-01-01'),
      leaveDate: new Date('2024-03-31'),
      addedBy: aisha._id
    });

    // Sam: active from Apr 15th, 2024
    await GroupMember.create({
      groupId: group._id,
      userId: sam._id,
      joinDate: new Date('2024-04-15'),
      leaveDate: null,
      addedBy: aisha._id
    });

    // Dev: active only for a trip in May (May 10 to May 20)
    await GroupMember.create({
      groupId: group._id,
      userId: dev._id,
      joinDate: new Date('2024-05-10'),
      leaveDate: new Date('2024-05-20'),
      addedBy: aisha._id
    });

    console.log('✅ Group members created.');
    console.log('\n==================================================');
    console.log('🎉 Seeding successfully completed!');
    console.log('==================================================');
    console.log('You can now log in using Aisha\'s account to test the system:');
    console.log('Email:    aisha@flatmates.com');
    console.log('Password: password123');
    console.log('Group ID: ' + group._id);
    console.log('==================================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedData();

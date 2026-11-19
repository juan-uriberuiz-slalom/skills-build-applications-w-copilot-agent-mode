import { Activity, Team, User, Workout } from '../models/index.js';
import { isValidObjectId } from 'mongoose';

export async function listActivities() {
  return Activity.find().lean();
}

export async function createActivity(_input: unknown) {
  if (!_input || typeof _input !== 'object') {
    throw Object.assign(new Error('Invalid activity input'), { status: 400 });
  }

  const input = _input as { userId?: unknown; teamId?: unknown; type?: unknown; minutes?: unknown };
  if (
    typeof input.userId !== 'string'
    || typeof input.teamId !== 'string'
    || typeof input.type !== 'string'
    || input.type.trim() === ''
    || typeof input.minutes !== 'number'
    || !Number.isFinite(input.minutes)
    || input.minutes <= 0
  ) {
    throw Object.assign(new Error('Invalid activity input'), { status: 400 });
  }

  if (!isValidObjectId(input.userId) || !isValidObjectId(input.teamId)) {
    throw Object.assign(new Error('Invalid userId or teamId'), { status: 400 });
  }

  const [user, team] = await Promise.all([
    User.findById(input.userId).lean(),
    Team.findById(input.teamId).lean(),
  ]);
  if (!user || !team) {
    throw Object.assign(new Error('User or team not found'), { status: 404 });
  }

  return Activity.create({
    user: user._id,
    team: team._id,
    type: input.type,
    minutes: input.minutes,
    points: input.minutes,
    occurredAt: new Date(),
  });
}

export async function listTeams() {
  return Team.find().lean();
}

export async function createTeam(_input: unknown) {
  if (!_input || typeof _input !== 'object') {
    throw Object.assign(new Error('Invalid team input'), { status: 400 });
  }

  const input = _input as { name?: unknown; mascot?: unknown; members?: unknown };
  if (
    typeof input.name !== 'string'
    || input.name.trim() === ''
    || typeof input.mascot !== 'string'
    || input.mascot.trim() === ''
    || (input.members !== undefined && !Array.isArray(input.members))
  ) {
    throw Object.assign(new Error('Invalid team input'), { status: 400 });
  }

  const memberIds = input.members ?? [];
  if (!Array.isArray(memberIds) || memberIds.some((id) => typeof id !== 'string' || !isValidObjectId(id))) {
    throw Object.assign(new Error('Invalid team member ID'), { status: 400 });
  }

  const members = await Promise.all(memberIds.map((id) => User.findById(id).lean()));
  if (members.some((member) => !member)) {
    throw Object.assign(new Error('Team member not found'), { status: 404 });
  }

  const team = await Team.create({
    name: input.name,
    mascot: input.mascot,
    members: memberIds,
  });
  await User.updateMany(
    { _id: { $in: memberIds } },
    { $set: { team: team._id } },
  );

  return team;
}

export async function getLeaderboard() {
  const entries = await Activity.aggregate([
    {
      $group: {
        _id: '$team',
        totalPoints: { $sum: '$points' },
      },
    },
    { $sort: { totalPoints: -1, _id: 1 } },
  ]);

  const teams = await Team.find({
    _id: { $in: entries.map((entry) => entry._id) },
  }).lean();
  const teamNames = new Map(
    teams.map((team) => [team._id.toString(), team.name]),
  );

  return entries
    .filter((entry) => teamNames.has(entry._id.toString()))
    .map((entry, index) => ({
      teamName: teamNames.get(entry._id.toString()),
      totalPoints: entry.totalPoints,
      rank: index + 1,
    }));
}

export async function suggestWorkouts(_userEmail: string) {
  if (typeof _userEmail !== 'string' || _userEmail.trim() === '') {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const user = await User.findOne({ email: decodeURIComponent(_userEmail).trim() }).lean();
  if (!user) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const activities = await Activity.find({ user: user._id }).lean();
  const activityTypes = new Set(
    activities
      .map((activity) => activity.type)
      .filter((type): type is string => typeof type === 'string')
      .map((type) => type.toLowerCase()),
  );

  const fitnessGoal = typeof user.fitnessGoal === 'string'
    ? user.fitnessGoal.toLowerCase()
    : '';
  const matchingFocuses = new Set([fitnessGoal, ...activityTypes]);
  const workouts = await Workout.find().lean();

  const suggestions = workouts
    .map((workout) => ({
      ...workout,
      reason: '',
    }))
    .filter((workout) => {
      const focus = typeof workout.focus === 'string'
        ? workout.focus.toLowerCase()
        : '';
      const matchesActivity = activityTypes.has(focus)
        || [...activityTypes].some((type) => focus.includes(type) || type.includes(focus));
      const matchesGoal = fitnessGoal !== '' && (
        focus === fitnessGoal
        || focus.includes(fitnessGoal)
        || fitnessGoal.includes(focus)
      );
      workout.reason = matchesActivity
        ? `Matches your ${workout.focus} activity pattern`
        : matchesGoal
          ? `Matches your ${workout.focus} endurance or fitness goal`
          : '';
      return matchesActivity || matchesGoal;
    })
    .map((workout) => ({
      title: workout.title,
      focus: workout.focus,
      minutes: workout.minutes,
      difficulty: workout.difficulty,
      reason: workout.reason,
    }));

  if (suggestions.length > 0) {
    return suggestions;
  }

  return workouts.slice(0, 1).map((workout) => ({
    title: workout.title,
    focus: workout.focus,
    minutes: workout.minutes,
    difficulty: workout.difficulty,
    reason: `General workout suggestion based on your activity: ${fitnessGoal || 'activity'}`,
  }));
}

export { User };

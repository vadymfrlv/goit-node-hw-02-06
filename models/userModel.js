const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');

const { emailRegEx, passwordRegEx } = require('../constants');

const userSchema = new Schema(
  {
    name: {
      type: String,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      match: emailRegEx,
      unique: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      match: passwordRegEx,
    },
    subscription: {
      type: String,
      enum: ['starter', 'pro', 'business'],
      default: 'starter',
    },
    avatarURL: {
      type: String,
      required: true,
    },
    token: {
      type: String,
      default: '',
    },
    verify: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      required: [true, 'Verify token is required'],
    },
  },
  { versionKey: false, timestamps: true }
);

userSchema.pre('save', async function () {
  if (this.isNew) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

const User = model('user', userSchema);

module.exports = User;

const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const Schema = mongoose.Schema

const User = new Schema({
  username: String,
  password: String,
  loginTime: {type: Number, default: Date.now()},
  nickname: String,
  birthday: Date,
  avatar: {type: String, default: 'remote_default_user.png'},
  sex: {type: String, default: 'U'},
  updateTime: {type: Number, default: Date.now()},
})

User.statics.generateHash = function (password) {
  const saltRounds = 10
  const salt = bcrypt.genSaltSync(saltRounds)
  return bcrypt.hashSync(password, salt)
}

// checking if password is valid
User.methods.validPassword = function (password) {
  return bcrypt.compareSync(password, this.password)
}

//ownerUserId follow targetUserId
const Follows = new Schema({
  ownerUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  targetUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  deleted: Boolean,
  updateTime: Number,
})
Follows.index({ownerUserId: 1, targetUserId: 1}, {unique: true})

//targetUserId follow ownerUserId
const Fans = new Schema({
  ownerUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  targetUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  deleted: Boolean,
  updateTime: Number,
})
Fans.index({ownerUserId: 1, targetUserId: 1}, {unique: true})

const Friends = new Schema({
  ownerUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  targetUserId: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  deleted: Boolean,
  updateTime: Number,
})
Friends.index({ownerUserId: 1, targetUserId: 1}, {unique: true})

module.exports = {
  User: mongoose.model('User', User),
  Follows: mongoose.model('Follows', Follows),
  Fans: mongoose.model('Fans', Fans),
  Friends: mongoose.model('Friends', Friends)
}
const mongoose = require('mongoose')
const Schema = mongoose.Schema
const passportLocalMongoose = require('passport-local-mongoose')

const User = new Schema({
  nickname: String,
  birthday: Date,
  avatar: {type: String, default: 'remote_default_user.png'},
  sex: {type: String, default: 'U'},
  updateTime: {type: Number, default: Date.now},
})

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

User.plugin(passportLocalMongoose)

module.exports = {
  User: mongoose.model('User', User),
  Follows: mongoose.model('Follows', Follows),
  Fans: mongoose.model('Fans', Fans),
  Friends: mongoose.model('Friends', Friends)
}
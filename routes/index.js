var express = require('express')
var router = express.Router()
const passport = require('passport')
const jwt = require('jsonwebtoken')
const {User, Follows, Fans, Friends} = require('../models/models')

async function getNewFollows (userId, startTime) {
  result = await Follows.find({
    ownerUserId: userId,
    updateTime: {$gt: startTime}
  }).populate('targetUserId', '_id username nickname birthday avatar sex updateTime')

  return result
}

async function getNewFans (userId, startTime) {
  result = await Fans.find({
    ownerUserId: userId,
    updateTime: {$gt: startTime}
  }).populate('targetUserId', '_id username nickname birthday avatar sex updateTime')

  return result
}

async function getNewFriends (userId, startTime) {
  result = await Friends.find({
    ownerUserId: userId,
    updateTime: {$gt: startTime}
  }).populate('targetUserId', '_id username nickname birthday avatar sex updateTime')

  return result
}

/* GET home page. */
router.post('/resetDB', async function (req, res, next) {
  const result1 = await User.remove({})
  const result2 = await Follows.remove({})
  const result3 = await Fans.remove({})
  const result4 = await Friends.remove({})

  //create 900 users
  let users = []
  const passwordHash = User.generateHash('1')
  for (let i = 1; i <= 900; i++) {
    users.push({
      username: 'u' + i,
      nickname: 'u' + i + 'n',
      password: passwordHash
    })
  }

  await User.insertMany(users)

  res.status(200).json('resetDB request ok')

})

router.post('/initRelation', async function (req, res, next) {
  const result2 = await Follows.remove({})
  const result3 = await Fans.remove({})
  const result4 = await Friends.remove({})

  const now = Date.now()
  //get all user id map
  const users = await User.find({})
  let usersMap = {}
  for (let i = 0; i < users.length; i++) {
    usersMap[users[i].username] = users[i]._id
  }

  //u1 follow u2-u300
  let follows1 = []
  let fans1 = []
  for (let i = 2; i <= 300; i++) {
    follows1.push({
      ownerUserId: usersMap['u1'],
      targetUserId: usersMap['u' + i],
      deleted: false,
      updateTime: now
    })

    fans1.push({
      ownerUserId: usersMap['u' + i],
      targetUserId: usersMap['u1'],
      deleted: false,
      updateTime: now
    })
  }

  await Follows.insertMany(follows1)
  await Fans.insertMany(fans1)

  //u301-u600 follow u1
  let follows2 = []
  let fans2 = []
  for (let i = 301; i <= 600; i++) {
    follows2.push({
      ownerUserId: usersMap['u' + i],
      targetUserId: usersMap['u1'],
      deleted: false,
      updateTime: now
    })

    fans2.push({
      ownerUserId: usersMap['u1'],
      targetUserId: usersMap['u' + i],
      deleted: false,
      updateTime: now
    })
  }

  await Follows.insertMany(follows2)
  await Fans.insertMany(fans2)

  //u1 and u601-u900 friends
  let follow3 = []
  let fans3 = []
  let friends3 = []
  for (let i = 601; i <= 900; i++) {
    follow3.push({
      ownerUserId: usersMap['u' + i],
      targetUserId: usersMap['u1'],
      deleted: false,
      updateTime: now
    })

    follow3.push({
      ownerUserId: usersMap['u1'],
      targetUserId: usersMap['u' + i],
      deleted: false,
      updateTime: now
    })

    fans3.push({
      ownerUserId: usersMap['u1'],
      targetUserId: usersMap['u' + i],
      deleted: false,
      updateTime: now
    })

    fans3.push({
      ownerUserId: usersMap['u' + i],
      targetUserId: usersMap['u1'],
      deleted: false,
      updateTime: now
    })

    friends3.push({
      ownerUserId: usersMap['u1'],
      targetUserId: usersMap['u' + i],
      deleted: false,
      updateTime: now
    })

    friends3.push({
      ownerUserId: usersMap['u' + i],
      targetUserId: usersMap['u1'],
      deleted: false,
      updateTime: now
    })
  }

  await Follows.insertMany(follow3)
  await Fans.insertMany(fans3)
  await Friends.insertMany(friends3)

  res.status(200).json('initRelation ok')

})

router.post('/follow/:userId', async function (req, res, next) {
  req.assert('userId', 'required').notEmpty()

  let validateError = await req.getValidationResult()

  if (!(validateError.isEmpty())) {
    return res
      .status(400)
      .json({error: validateError.array()})
  }

  const userId = req.params.userId

  passport.authenticate('jwt', async function (err, user, info) {
    if (err) {
      return next(err)
    }
    if (!user) {
      return res.status(500).json({code: -1000, info: info})
    }

    try {
      //检查userId是否有对应用户
      const targetUser = await User.findOne({_id: userId})
      if (targetUser == null) {
        return res
          .status(500)
          .json({code: -1, error: '无此目标用户!'})
      }

      const followResult = await Follows.findOneAndUpdate({
          ownerUserId: user._id,
          targetUserId: userId
        },
        {
          ownerUserId: user._id,
          targetUserId: userId,
          deleted: false,
          updateTime: Date.now()
        },
        {
          upsert: true,
          new: false
        })

      const fansResult = await Fans.findOneAndUpdate({
          ownerUserId: userId,
          targetUserId: user._id
        },
        {
          ownerUserId: userId,
          targetUserId: user._id,
          deleted: false,
          updateTime: Date.now()
        },
        {
          upsert: true,
          new: false
        })

      if (fansResult == null || fansResult.deleted == true) {
        //确认记录确实从无到有, 或者从deleted == true 到 deleted == false, 应该要通知Fans的ownerUserId

        global.clients[userId] && global.clients[userId].emit('pushEvent', {type: 'get_new_fans'})

        //检查是否已成为好友
        const tmpResult = await Follows.findOne({
          ownerUserId: userId,
          targetUserId: user._id,
          deleted: false
        })

        const now = Date.now()

        if (tmpResult != null) {
          //结成好友
          const friendResult1 = await Friends.findOneAndUpdate({
              ownerUserId: userId,
              targetUserId: user._id
            },
            {
              ownerUserId: userId,
              targetUserId: user._id,
              deleted: false,
              updateTime: now
            },
            {
              upsert: true,
              new: false
            })

          const friendResult2 = await Friends.findOneAndUpdate({
              ownerUserId: user._id,
              targetUserId: userId
            },
            {
              ownerUserId: user._id,
              targetUserId: userId,
              deleted: false,
              updateTime: now
            },
            {
              upsert: true,
              new: false
            })

          global.clients[userId] && global.clients[userId].emit('pushEvent', {type: 'get_new_friends'})

          global.clients[user._id] && global.clients[user._id].emit('pushEvent', {type: 'get_new_friends'})

        }
      }

      global.clients[user._id] && global.clients[user._id].emit('pushEvent', {type: 'get_new_follows'})

      return res
        .status(200)
        .json('ok')
    } catch (err) {
      return res
        .status(400)
        .json({code: -1, error: err.toString()})
    }
  })(req, res, next)
})

router.post('/unFollow/:userId', async function (req, res, next) {
  req.assert('userId', 'required').notEmpty()

  let validateError = await req.getValidationResult()

  if (!(validateError.isEmpty())) {
    return res
      .status(400)
      .json({error: validateError.array()})
  }

  const userId = req.params.userId

  passport.authenticate('jwt', async function (err, user, info) {
    if (err) {
      return next(err)
    }
    if (!user) {
      return res.status(500).json({code: -1000, error: info})
    }

    try {
      //检查是否可以unfollow(非朋友 and 自己的follow中有对方)
      const tmpFriend = await Friends.findOne({
        ownerUserId: user._id,
        deleted: false,
        targetUserId: userId
      })

      if (tmpFriend != null) {
        return res
          .status(500)
          .json({code: -1, error: '已是互为好友, 不能取消关注, 只能解除好友!'})
      }

      const tmpFollow = await Follows.findOne({
        ownerUserId: user._id,
        deleted: false,
        targetUserId: userId
      })

      if (tmpFollow == null) {
        return res
          .status(500)
          .json({code: -1, error: '关注列表无此用户, 不能取消关注!'})
      }

      //检查userId是否有对应用户
      const targetUser = await User.findOne({_id: userId})
      if (targetUser == null) {
        return res
          .status(500)
          .json({code: -1, error: '无此目标用户!'})
      }

      const followResult = await Follows.findOneAndUpdate({
          ownerUserId: user._id,
          targetUserId: userId
        },
        {
          ownerUserId: user._id,
          targetUserId: userId,
          deleted: true,
          updateTime: Date.now()
        },
        {
          upsert: true,
          new: false
        })

      if (followResult != null || followResult.deleted == false) {
        //确认记录确实从deleted == false 到 deleted == true, 应该要通知Follows的ownerUserId
        global.clients[user._id] && global.clients[user._id].emit('pushEvent', {type: 'delete_follows'})
      }

      const fansResult = await Fans.findOneAndUpdate({
          ownerUserId: userId,
          targetUserId: user._id
        },
        {
          ownerUserId: userId,
          targetUserId: user._id,
          deleted: true,
          updateTime: Date.now()
        },
        {
          upsert: true,
          new: false
        })

      if (fansResult != null || fansResult.deleted == false) {
        //确认记录确实从deleted == false 到 deleted == true, 应该要通知Fans的ownerUserId
        global.clients[userId] && global.clients[userId].emit('pushEvent', {type: 'delete_fans'})
      }

      return res
        .status(200)
        .json('ok')
    } catch (err) {
      return res
        .status(400)
        .json({code: -1, error: err.toString()})
    }
  })(req, res, next)
})

router.post('/unFriend/:userId', async function (req, res, next) {
  req.assert('userId', 'required').notEmpty()

  let validateError = await req.getValidationResult()

  if (!(validateError.isEmpty())) {
    return res
      .status(400)
      .json({error: validateError.array()})
  }

  const userId = req.params.userId

  passport.authenticate('jwt', async function (err, user, info) {
    console.log(err, info)
    if (err) {
      return next(err)
    }
    if (!user) {
      return res.status(500).json({code: -1000, error: info})
    }

    try {
      //检查是否可以unfriend(朋友)
      const tmpFriend = await Friends.findOne({
        ownerUserId: user._id,
        deleted: false,
        targetUserId: userId
      })

      if (tmpFriend == null) {
        return res
          .status(500)
          .json({code: -1, error: '不是好友, 不能解除好友!'})
      }

      //取消好友, follows, fans从此是路人
      const friendResult1 = await Friends.findOneAndUpdate({
          ownerUserId: user._id,
          targetUserId: userId
        },
        {
          ownerUserId: user._id,
          targetUserId: userId,
          deleted: true,
          updateTime: Date.now()
        },
        {
          upsert: true,
          new: false
        })

      if (friendResult1 != null || friendResult1.deleted == false) {
        //确认记录确实从deleted == false 到 deleted == true, 应该要通知ownerUserId
        global.clients[user._id] && global.clients[user._id].emit('pushEvent', {type: 'delete_friends'})
      }

      const friendResult2 = await Friends.findOneAndUpdate({
          ownerUserId: userId,
          targetUserId: user._id
        },
        {
          ownerUserId: userId,
          targetUserId: user._id,
          deleted: true,
          updateTime: Date.now()
        },
        {
          upsert: true,
          new: false
        })

      if (friendResult2 != null || friendResult2.deleted == false) {
        //确认记录确实从deleted == false 到 deleted == true, 应该要通知ownerUserId
        global.clients[userId] && global.clients[userId].emit('pushEvent', {type: 'delete_friends'})
      }

      const followResult1 = await Follows.findOneAndUpdate({
          ownerUserId: user._id,
          targetUserId: userId
        },
        {
          ownerUserId: user._id,
          targetUserId: userId,
          deleted: true,
          updateTime: Date.now()
        },
        {
          upsert: true,
          new: false
        })

      if (followResult1 != null || followResult1.deleted == false) {
        //确认记录确实从deleted == false 到 deleted == true, 应该要通知ownerUserId
        global.clients[user._id] && global.clients[user._id].emit('pushEvent', {type: 'delete_follows'})
      }

      const followResult2 = await Follows.findOneAndUpdate({
          ownerUserId: userId,
          targetUserId: user._id
        },
        {
          ownerUserId: userId,
          targetUserId: user._id,
          deleted: true,
          updateTime: Date.now()
        },
        {
          upsert: true,
          new: false
        })

      if (followResult2 != null || followResult2.deleted == false) {
        //确认记录确实从deleted == false 到 deleted == true, 应该要通知ownerUserId
        global.clients[userId] && global.clients[userId].emit('pushEvent', {type: 'delete_follows'})
      }

      const fansResult1 = await Fans.findOneAndUpdate({
          ownerUserId: user._id,
          targetUserId: userId
        },
        {
          ownerUserId: user._id,
          targetUserId: userId,
          deleted: true,
          updateTime: Date.now()
        },
        {
          upsert: true,
          new: false
        })

      if (fansResult1 != null || fansResult1.deleted == false) {
        //确认记录确实从deleted == false 到 deleted == true, 应该要通知ownerUserId
        global.clients[user._id] && global.clients[user._id].emit('pushEvent', {type: 'delete_fans'})
      }

      const fansResult2 = await Fans.findOneAndUpdate({
          ownerUserId: userId,
          targetUserId: user._id
        },
        {
          ownerUserId: userId,
          targetUserId: user._id,
          deleted: true,
          updateTime: Date.now()
        },
        {
          upsert: true,
          new: false
        })

      if (fansResult2 != null || fansResult2.deleted == false) {
        //确认记录确实从deleted == false 到 deleted == true, 应该要通知ownerUserId
        global.clients[userId] && global.clients[userId].emit('pushEvent', {type: 'delete_fans'})
      }

      return res
        .status(200)
        .json('ok')
    } catch (err) {
      return res
        .status(400)
        .json({code: -1, error: err.toString()})
    }
  })(req, res, next)
})

router.post('/getNewFollows/:startTime', async function (req, res, next) {
  req.assert('startTime', 'required').notEmpty()

  let validateError = await req.getValidationResult()

  if (!(validateError.isEmpty())) {
    return res
      .status(400)
      .json({error: validateError.array()})
  }

  passport.authenticate('jwt', async function (err, user, info) {
    if (err) {
      return next(err)
    }
    if (!user) {
      return res.status(500).json({code: -1000, error: info})
    }

    const startTime = req.params.startTime

    try {
      result = await getNewFollows(user._id, startTime)

      return res
        .status(200)
        .json(result)
    } catch (err) {
      return res
        .status(400)
        .json({code: -1, error: err.toString()})
    }
  })(req, res, next)
})

router.post('/getNewFans/:startTime', async function (req, res, next) {
  req.assert('startTime', 'required').notEmpty()

  let validateError = await req.getValidationResult()

  if (!(validateError.isEmpty())) {
    return res
      .status(400)
      .json({error: validateError.array()})
  }

  passport.authenticate('jwt', async function (err, user, info) {
    if (err) {
      return next(err)
    }
    if (!user) {
      return res.status(500).json({code: -1000, error: info})
    }

    const startTime = req.params.startTime

    try {
      result = await getNewFans(user._id, startTime)

      return res
        .status(200)
        .json(result)
    } catch (err) {
      return res
        .status(400)
        .json({code: -1, error: err.toString()})
    }
  })(req, res, next)
})

router.post('/getNewFriends/:startTime', async function (req, res, next) {
  req.assert('startTime', 'required').notEmpty()

  let validateError = await req.getValidationResult()

  if (!(validateError.isEmpty())) {
    return res
      .status(400)
      .json({error: validateError.array()})
  }

  passport.authenticate('jwt', async function (err, user, info) {
    if (err) {
      return next(err)
    }
    if (!user) {
      return res.status(500).json({code: -1000, error: info})
    }

    const startTime = req.params.startTime

    try {
      result = await getNewFriends(user._id, startTime)

      return res
        .status(200)
        .json(result)
    } catch (err) {
      return res
        .status(400)
        .json({code: -1, error: err.toString()})
    }
  })(req, res, next)
})

router.post('/getUserInfo/:userId', async function (req, res, next) {
  req.assert('userId', 'required').notEmpty()

  let validateError = await req.getValidationResult()

  if (!(validateError.isEmpty())) {
    return res
      .status(400)
      .json({error: validateError.array()})
  }

  passport.authenticate('jwt', async function (err, user, info) {
    if (err) {
      return next(err)
    }
    if (!user) {
      return res.status(500).json({code: -1000, error: info})
    }

    const userId = req.params.userId

    try {
      const result = await User.findById({
          _id: userId
        },
        {
          nickname: 1,
          birthday: 1,
          avatar: 1,
          sex: 1,
          updateTime: 1
        })

      return res
        .status(200)
        .json(result)
    } catch (err) {
      return res
        .status(400)
        .json({code: -1, error: err.toString()})
    }
  })(req, res, next)
})

router.post('/getOtherUsers', async function (req, res, next) {
  let validateError = await req.getValidationResult()

  if (!(validateError.isEmpty())) {
    return res
      .status(400)
      .json({error: validateError.array()})
  }

  passport.authenticate('jwt', async function (err, user, info) {
    if (err) {
      return next(err)
    }
    if (!user) {
      return res.status(500).json({code: -1000, error: info})
    }

    try {
      const result = await User.find({
          _id: {$ne: user._id}
        },
        {
          username: 1,
          nickname: 1,
          birthday: 1,
          avatar: 1,
          sex: 1,
          updateTime: 1
        })
        .sort({
          updateTime: -1
        })

      return res
        .status(200)
        .json(result)
    } catch (err) {
      return res
        .status(400)
        .json({code: -1, error: err.toString()})
    }
  })(req, res, next)
})

router.post('/getMyProfile', async function (req, res, next) {
  let validateError = await req.getValidationResult()

  if (!(validateError.isEmpty())) {
    return res
      .status(400)
      .json({error: validateError.array()})
  }

  passport.authenticate('jwt', async function (err, user, info) {
    if (err) {
      return next(err)
    }
    if (!user) {
      return res.status(500).json({code: -1000, error: info})
    }

    try {
      const result = await User.findOne({
          _id: user._id
        },
        {
          username: 1,
          nickname: 1,
          birthday: 1,
          avatar: 1,
          sex: 1,
          updateTime: 1
        })

      return res
        .status(200)
        .json(result)
    } catch (err) {
      return res
        .status(400)
        .json({code: -1, error: err.toString()})
    }
  })(req, res, next)
})

module.exports = router

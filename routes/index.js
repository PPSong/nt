var express = require('express')
var router = express.Router()
const passport = require('passport')
const jwt = require('jsonwebtoken')
const {User, Follows, Fans, Friends, Blocks, Message, Moment, Comment} = require('../models/models')
var qiniu = require('qiniu')

const bucket = 'pptest'
const mac = new qiniu.auth.digest.Mac('5cA4T4oBfXgCTDnMTW3jOrCmyo9QpXGnroKdbEPr', '1HVR6ttN6n2WysdSGbyJCNn3pZNX2rCI7d8Xbj94')
var options = {
  scope: bucket,
}
var putPolicy = new qiniu.rs.PutPolicy(options)

async function getNewFollows (userId, startTime) {
  result = await Follows.find({
    ownerUserId: userId,
    updateTime: {$gt: startTime}
  }).populate('targetUserId', '_id nickname birthday avatar sex updateTime')

  return result
}

async function getNewFans (userId, startTime) {
  result = await Fans.find({
    ownerUserId: userId,
    updateTime: {$gt: startTime}
  }).populate('targetUserId', '_id nickname birthday avatar sex updateTime')

  return result
}

async function getNewFriends (userId, startTime) {
  result = await Friends.find({
    ownerUserId: userId,
    updateTime: {$gt: startTime}
  }).populate('targetUserId', '_id nickname birthday avatar sex updateTime')

  return result
}

async function getNewBlocks (userId, startTime) {
  result = await Blocks.find({
    $or: [
      {ownerUserId: userId},
      {targetUserId: userId}
    ],
    updateTime: {$gt: startTime}
  })
    // .populate([
    //   {path: 'ownerUserId', select: '_id nickname birthday avatar sex updateTime'},
    //   {path: 'targetUserId', select: '_id nickname birthday avatar sex updateTime'}
    // ])

  return result
}

async function unblockUsers (user, userIds) {
  const now = Date.now()

  for (var i = 0; i < userIds.length; i++) {
    const userId = userIds[i]

    console.log("unblock:" + userId);
    //添加block列表
    const blockResult = await Blocks.findOneAndUpdate({
        ownerUserId: user._id,
        targetUserId: userId
      },
      {
        $set: {
          deleted: true,
          updateTime: now
        }
      },
      {
        upsert: true,
        new: false
      })

    if (blockResult == null || blockResult.deleted == false) {
      //确认记录确实从无到有, 或者从deleted == false 到 deleted == true, 应该要通知targetUserId, ownerUserId
      global.clients[userId] && global.clients[userId].emit('pushEvent', {type: 'get_new_blocks'})
    }
  }

  global.clients[user._id] && global.clients[user._id].emit('pushEvent', {type: 'get_new_blocks'})
}

async function blockUsers (user, userIds) {
  console.log("blockUsers:" + userIds);
  const now = Date.now()

  for (var i = 0; i < userIds.length; i++) {
    const userId = userIds[i]

    //解除所有关系, 从此是路人
    await Follows.update(
      {
        $or: [
          {
            ownerUserId: user._id,
            targetUserId: userId
          },
          {
            ownerUserId: userId,
            targetUserId: user._id
          }
        ],
        deleted: false
      },
      {
        $set: {
          deleted: true,
          updateTime: now
        }
      },
      {
        multi: true
      }
    )

    await Fans.update(
      {
        $or: [
          {
            ownerUserId: user._id,
            targetUserId: userId
          },
          {
            ownerUserId: userId,
            targetUserId: user._id
          }
        ],
        deleted: false
      },
      {
        $set: {
          deleted: true,
          updateTime: now
        }
      },
      {
        multi: true
      }
    )

    await Friends.update(
      {
        $or: [
          {
            ownerUserId: user._id,
            targetUserId: userId
          },
          {
            ownerUserId: userId,
            targetUserId: user._id
          }
        ],
        deleted: false
      },
      {
        $set: {
          deleted: true,
          updateTime: now
        }
      },
      {
        multi: true
      }
    )

    //添加block列表
    const blockResult = await Blocks.findOneAndUpdate({
        ownerUserId: user._id,
        targetUserId: userId
      },
      {
        deleted: false,
        updateTime: now
      },
      {
        upsert: true,
        new: false
      })

    console.log("blockResult:" + blockResult);

    if (blockResult == null || blockResult.deleted == true) {
      //确认记录确实从无到有, 或者从deleted == true 到 deleted == false, 应该要通知targetUserId, ownerUserId

      global.clients[userId] && global.clients[userId].emit('pushEvent', {type: 'get_new_blocks'})
      global.clients[userId] && global.clients[userId].emit('pushEvent', {type: 'get_new_fans'})
      global.clients[userId] && global.clients[userId].emit('pushEvent', {type: 'get_new_follows'})
      global.clients[userId] && global.clients[userId].emit('pushEvent', {type: 'get_new_friends'})
    }
  }
  global.clients[user._id] && global.clients[user._id].emit('pushEvent', {type: 'get_new_blocks'})
  global.clients[user._id] && global.clients[user._id].emit('pushEvent', {type: 'get_new_fans'})
  global.clients[user._id] && global.clients[user._id].emit('pushEvent', {type: 'get_new_follows'})
  global.clients[user._id] && global.clients[user._id].emit('pushEvent', {type: 'get_new_friends'})
}

router.post('/test', async function (req, res, next) {
  setTimeout(() => {
    res.status(200).json('test ok')
  }, 3000)
})

/* GET home page. */
router.post('/resetDB', async function (req, res, next) {
  const result1 = await User.remove({})
  const result2 = await Follows.remove({})
  const result3 = await Fans.remove({})
  const result4 = await Friends.remove({})
  const result5 = await Blocks.remove({})
  const result6 = await Comment.remove({})
  const result7 = await Message.remove({})
  const result8 = await Moment.remove({})

  //create 900 users
  let users = []
  const passwordHash = User.generateHash('1')
  for (let i = 1; i <= 900; i++) {
    users.push({
      _id: 'u' + i,
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
    usersMap[users[i]._id] = users[i]._id
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
      return res.status(500).json({code: -1000, error: info})
    }

    try {
      //检查userId是否有对应用户
      const targetUser = await User.findOne({_id: userId})
      if (targetUser == null) {
        return res
          .status(500)
          .json({code: -1, error: '无此目标用户!'})
      }

      //检查是否有block
      const blockResult = await Blocks.find({
        $or: [
          {
            ownerUserId: user._id,
            targetUserId: userId
          },
          {
            ownerUserId: userId,
            targetUserId: user._id
          }
        ],
        deleted: false
      })

      if (blockResult.length > 0) {
        return res
          .status(500)
          .json({code: -1, error: '屏蔽或被屏蔽中!'})
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
      //检查是否有block
      const blockResult = await Blocks.find({
        $or: [
          {
            ownerUserId: user._id,
            targetUserId: userId
          },
          {
            ownerUserId: userId,
            targetUserId: user._id
          }
        ],
        deleted: false
      })

      if (blockResult.length > 0) {
        return res
          .status(500)
          .json({code: -1, error: '屏蔽或被屏蔽中!'})
      }

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

      console.log('pptest0')
      console.log(followResult)

      if (followResult != null || followResult.deleted == false) {
        console.log('pptest1')
        //确认记录确实从deleted == false 到 deleted == true, 应该要通知Follows的ownerUserId
        global.clients[user._id] && global.clients[user._id].emit('pushEvent', {type: 'get_new_follows'})
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
        global.clients[userId] && global.clients[userId].emit('pushEvent', {type: 'get_new_fans'})
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
      //检查是否有block
      const blockResult = await Blocks.find({
        $or: [
          {
            ownerUserId: user._id,
            targetUserId: userId
          },
          {
            ownerUserId: userId,
            targetUserId: user._id
          }
        ],
        deleted: false
      })

      if (blockResult.length > 0) {
        return res
          .status(500)
          .json({code: -1, error: '屏蔽或被屏蔽中!'})
      }

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
        global.clients[user._id] && global.clients[user._id].emit('pushEvent', {type: 'get_new_friends'})
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
        global.clients[userId] && global.clients[userId].emit('pushEvent', {type: 'get_new_friends'})
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
        global.clients[user._id] && global.clients[user._id].emit('pushEvent', {type: 'get_new_follows'})
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
        global.clients[userId] && global.clients[userId].emit('pushEvent', {type: 'get_new_follows'})
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
        global.clients[user._id] && global.clients[user._id].emit('pushEvent', {type: 'get_new_fans'})
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
        global.clients[userId] && global.clients[userId].emit('pushEvent', {type: 'get_new_fans'})
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

router.post('/getNewBlocks/:startTime', async function (req, res, next) {
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
      result = await getNewBlocks(user._id, startTime)

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
      //检查是否有block
      const blockResult = await Blocks.find({
        $or: [
          {
            ownerUserId: user._id,
            targetUserId: userId
          },
          {
            ownerUserId: userId,
            targetUserId: user._id
          }
        ],
        deleted: false
      })

      if (blockResult.length > 0) {
        return res
          .status(500)
          .json({code: -1, error: '屏蔽或被屏蔽中!'})
      }

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

router.post('/getOtherUsers/:afterUserId', async function (req, res, next) {
  const pageSize = 20

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

    const afterUserId = req.params.afterUserId ? req.params.afterUserId : '0'
    console.log('afterUserId:' + afterUserId)
    try {
      //获取block我的人
      const blockMe = await Blocks.find({
        targetUserId: user._id,
        deleted: false
      }, {
        ownerUserId: 1
      })

      //获取我block的人
      const myBlock = await Blocks.find({
          ownerUserId: user._id,
          deleted: false
        },
        {
          targetUserId: 1
        })

      const result = await User.find({
          _id: {
            $ne: user._id,
            $nin: blockMe.map(item => item.ownerUserId),
            $nin: myBlock.map(item => item.targetUserId),
            $gt: afterUserId
          }
        },
        {
          nickname: 1,
          birthday: 1,
          avatar: 1,
          sex: 1,
          updateTime: 1
        })
        .sort({
          _id: 1
        })
        .limit(pageSize)

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

router.post('/getQiniuToken', async function (req, res, next) {
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

      const token = putPolicy.uploadToken(mac)

      return res
        .status(200)
        .json({
          token: token
        })
    } catch (err) {
      return res
        .status(400)
        .json({code: -1, error: err.toString()})
    }
  })(req, res, next)
})

router.post('/updateAvatar/:avatarImageName', async function (req, res, next) {
  req.assert('avatarImageName', 'required').notEmpty()

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
      user.avatar = req.params.avatarImageName
      user.updateTime = Date.now()
      await user.save()

      global.clients[user._id] && global.clients[user._id].emit('pushEvent', {type: 'profile_updated'})

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

router.post('/block', async function (req, res, next) {
  req.assert('userIds', 'required').notEmpty()

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
      console.log(req.body.userIds)
      const userIds = JSON.parse(req.body.userIds)
      console.log("pptest:" + userIds.length)
      console.log(userIds)

      for (var i = 0; i < userIds.length; i++) {
        if (userIds[i] == user._id) {
          return res
            .status(500)
            .json({code: -1, error: '不能屏蔽自己!'})
        }
      }

      blockUsers(user, userIds)

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

router.post('/unBlock', async function (req, res, next) {
  req.assert('userIds', 'required').notEmpty()

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
      console.log(req.body.userIds)
      const userIds = JSON.parse(req.body.userIds)
      console.log("pptest:" + userIds.length)
      console.log(userIds)

      for (var i = 0; i < userIds.length; i++) {
        if (userIds[i] == user._id) {
          return res
            .status(500)
            .json({code: -1, error: '不能解禁自己!'})
        }
      }

      unblockUsers(user, userIds)

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

router.post('/sendMessage/:_id/:body/:createTime/:lnt/:lat', async function (req, res, next) {
  req.assert('_id', 'required').notEmpty()
  req.assert('body', 'required').notEmpty()
  req.assert('createTime', 'required').notEmpty()
  req.assert('lnt', 'required').notEmpty()
  req.assert('lat', 'required').notEmpty()

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
      const location = {'type': 'Point', 'coordinates': [req.params.lnt, req.params.lat]}

      await Message.update({
          _id: req.params._id
        },
        {
          $set: {
            userId: user._id,
            body: req.params.body,
            createTime: req.params.createTime,
            loc: location
          }
        },
        {
          upsert: true
        })

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

router.post('/getMessage/:lnt/:lat/:fromTime?', async function (req, res, next) {
  req.assert('lnt', 'required').notEmpty()
  req.assert('lat', 'required').notEmpty()

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
      const fifteenMAgo = Date.now() - (15 * 60 * 1000)
      let time = fifteenMAgo
      if (req.params.fromTime) {
        time = req.params.fromTime > time ? req.params.fromTime : time
      }

      //todo 有可能需要用redis缓存当前的blocklist来提高读取效率
      //处理block
      const blockResult1 = await Blocks.find({
        ownerUserId: user._id,
        deleted: false
      }, {
        targetUserId: 1
      })

      const blockResult1Users = blockResult1.map(item => item.targetUserId)

      const blockResult2 = await Blocks.find({
        targetUserId: user._id,
        deleted: false
      }, {
        ownerUserId: 1
      })

      const blockResult2Users = blockResult2.map(item => item.ownerUserId)

      const blockList = blockResult1Users.concat(blockResult2Users)

      const result = await Message.find({
        userId: {
          $nin: blockList
        },
        createTime: {$gt: time},
        loc: {
          '$near': {
            '$maxDistance': 500,
            '$geometry': {type: 'Point', coordinates: [req.params.lnt, req.params.lat]}
          }
        }
      }).populate('userId', '_id nickname avatar')

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

router.post('/sendMoment/:_id/:image/:body/:createTime/:lnt/:lat', async function (req, res, next) {
  req.assert('_id', 'required').notEmpty()
  req.assert('image', 'required').notEmpty()
  req.assert('body', 'required').notEmpty()
  req.assert('createTime', 'required').notEmpty()
  req.assert('lnt', 'required').notEmpty()
  req.assert('lat', 'required').notEmpty()

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
      const location = {'type': 'Point', 'coordinates': [req.params.lnt, req.params.lat]}

      await Moment.update({
          _id: req.params._id
        },
        {
          $set: {
            userId: user._id,
            image: req.params.image,
            body: req.params.body,
            createTime: req.params.createTime,
            loc: location
          }
        },
        {
          upsert: true
        })

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

router.post('/getMoment/:lnt/:lat/:fromTime?', async function (req, res, next) {
  req.assert('lnt', 'required').notEmpty()
  req.assert('lat', 'required').notEmpty()

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
      const now = Date.now()
      let time = now
      if (req.params.fromTime) {
        time = req.params.fromTime < time ? req.params.fromTime : time
      }

      //处理block
      const blockResult1 = await Blocks.find({
        ownerUserId: user._id,
        deleted: false
      }, {
        targetUserId: 1
      })

      const blockResult1Users = blockResult1.map(item => item.targetUserId)

      const blockResult2 = await Blocks.find({
        targetUserId: user._id,
        deleted: false
      }, {
        ownerUserId: 1
      })

      const blockResult2Users = blockResult2.map(item => item.ownerUserId)

      const blockList = blockResult1Users.concat(blockResult2Users)

      console.log(blockList)

      const result = await Moment.find({
        userId: {
          $nin: blockList
        },
        createTime: {$lt: time},
        loc: {
          '$near': {
            '$maxDistance': 500,
            '$geometry': {type: 'Point', coordinates: [req.params.lnt, req.params.lat]}
          }
        }
      })
        .sort({createTime: -1})
        .limit(5)
        .populate('userId', '_id nickname avatar')

      console.log(result)

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

router.post('/getMyMoment/:fromTime?', async function (req, res, next) {

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
      const now = Date.now()
      let time = now
      if (req.params.fromTime) {
        time = req.params.fromTime < time ? req.params.fromTime : time
      }

      const result = await Moment.find({
        userId: user._id,
        createTime: {$lt: time}
      })
        .sort({createTime: -1})
        .limit(5)

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

router.post('/getMomentDetail/:momentId', async function (req, res, next) {
  req.assert('momentId', 'required').notEmpty()

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
      //处理block
      const blockResult1 = await Blocks.find({
        ownerUserId: user._id,
        deleted: false
      }, {
        targetUserId: 1
      })

      const blockResult1Users = blockResult1.map(item => item.targetUserId)

      const blockResult2 = await Blocks.find({
        targetUserId: user._id,
        deleted: false
      }, {
        ownerUserId: 1
      })

      const blockResult2Users = blockResult2.map(item => item.ownerUserId)

      const blockList = blockResult1Users.concat(blockResult2Users)

      const result = await Moment.findOne({
        _id: req.params.momentId,
        userId: {
          $nin: blockList
        }
      })
        .populate('userId', '_id nickname avatar')

      console.log(result)

      if (result == null) {
        return res
          .status(400)
          .json({code: -1, error: '无对应记录或有屏蔽关系!'})
      } else {
        return res
          .status(200)
          .json(result)
      }
    } catch (err) {
      return res
        .status(400)
        .json({code: -1, error: err.toString()})
    }
  })(req, res, next)
})

router.post('/sendComment/:_id/:momentId/:body/:createTime', async function (req, res, next) {
  req.assert('_id', 'required').notEmpty()
  req.assert('momentId', 'required').notEmpty()
  req.assert('body', 'required').notEmpty()
  req.assert('createTime', 'required').notEmpty()

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
      //处理block
      const blockResult1 = await Blocks.find({
        ownerUserId: user._id,
        deleted: false
      }, {
        targetUserId: 1
      })

      const blockResult1Users = blockResult1.map(item => item.targetUserId)

      const blockResult2 = await Blocks.find({
        targetUserId: user._id,
        deleted: false
      }, {
        ownerUserId: 1
      })

      const blockResult2Users = blockResult2.map(item => item.ownerUserId)

      const blockList = blockResult1Users.concat(blockResult2Users)

      const targetMoment = await Moment.findOne({
        _id: req.params.momentId,
        userId: {
          $nin: blockList
        }
      })

      if (targetMoment == null) {
        return res
          .status(500)
          .json({code: -1, error: '无此moment, 或对方屏蔽或被屏蔽中!'})
      }

      await Comment.update({
          _id: req.params._id,
          momentId: req.params.momentId
        },
        {
          $set: {
            userId: user._id,
            body: req.params.body,
            createTime: req.params.createTime,
          }
        },
        {
          upsert: true
        })

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

router.post('/getComments/:momentId', async function (req, res, next) {
  req.assert('momentId', 'required').notEmpty()

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
      //处理block
      const blockResult1 = await Blocks.find({
        ownerUserId: user._id,
        deleted: false
      }, {
        targetUserId: 1
      })

      const blockResult1Users = blockResult1.map(item => item.targetUserId)

      const blockResult2 = await Blocks.find({
        targetUserId: user._id,
        deleted: false
      }, {
        ownerUserId: 1
      })

      const blockResult2Users = blockResult2.map(item => item.ownerUserId)

      const blockList = blockResult1Users.concat(blockResult2Users)

      const result = await Comment.find({
        momentId: req.params.momentId,
        userId: {
          $nin: blockList
        }
      })
        .sort({
          createTime: 1
        })
        .populate('userId', '_id nickname avatar')

      console.log('comments')
      console.log(result)

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

router.post('/deleteComment/:commentId', async function (req, res, next) {
  req.assert('commentId', 'required').notEmpty()

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

      const result = await Comment.remove({
        _id: req.params.commentId,
        userId: user._id
      })

      console.log(result)

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

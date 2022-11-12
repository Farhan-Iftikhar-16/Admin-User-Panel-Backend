const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');

const userSchema = mongoose.Schema({
  userId: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  mobileNumber: {
    type: String,
    required: false
  },
  gender: {
    type: String,
    required: false
  },
  dateOfBirth: {
    type: String,
    required: false
  },
  addressDetails: {
    type: Object,
    required: false
  },
  role: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  contractDate: {
    type: String,
    required: true
  },
  status: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    required: true
  },
  updatedAt: {
    type: Date,
    required: true
  }
});

const User = module.exports = mongoose.model('User', userSchema);

module.exports.createUser = (req , res) => {
  User.findOne({email: req.body.email}, (error, user) => {
    if (error) {
      res.status(500).json({success: false, message: 'Error occurred while creating account.'});
      return;
    }

    if (user) {
      res.status(409).json({success: false, message: 'User already exists with provided email.'});
      return;
    }

    if(!user) {
      const user = new User({
        userId: req.body.userId,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        gender: req.body.gender,
        dateOfBirth: req.body.dateOfBirth,
        mobileNumber: req.body.mobileNumber,
        addressDetails: req.body.addressDetails,
        role: req.body.role,
        contractDate: req.body.contractDate,
        password: 'User@123',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      bcryptjs.genSalt(10, (error, salt) => {
        if(error) {
          res.status(500).json({success: false, message: 'Error occurred while encrypting the password.'});
          return;
        }

        if(!error) {
          bcryptjs.hash(user.password, salt, (error, hash) => {
            if(error) {
              res.status(500).json({success: false, message: 'Error occurred while encrypting the password.'});
              return;
            }

            if(!error) {
              user.password = hash;
              user.save((error)=> {
                if(error) {
                  res.status(500).json({success: false, message: 'Error occurred while creating account.'});
                  return;
                }

                if(!error) {
                  res.status(200).json({success: true, message: 'Account created successfully.'});
                }
              });
            }
          })
        }
      });
    }
  });
}

module.exports.updateUser = (req , res) => {
  User.findOneAndUpdate({_id: req.params.id}, req.body,{}, error => {
    if (error) {
      res.status(500).json({success: false, message: 'Error occurred while updating details of user.'});
      return;
    }

    if (!error) {
      res.status(200).json({success: true, message: 'User details updated successfully.'});
    }
  });
}

module.exports.getUserByID = (req , res) => {
  User.findById(req.params.id, req.body,{}, (error, response) => {
    if (error) {
      res.status(500).json({success: false, message: 'Error occurred while updating details of user.'});
      return;
    }

    if (response) {
      const user = {
        _id: response._id,
        userId: response.userId,
        firstName: response.firstName,
        lastName: response.lastName,
        email: response.email,
        gender: response.gender,
        dateOfBirth: response.dateOfBirth,
        mobileNumber: response.mobileNumber,
        addressDetails: response.addressDetails,
        status: response.status,
        role: response.role,
        contractDate: response.contractDate,
        createdAt: response.createdAt,
        updatedAt: response.updatedAt
      }
      res.status(200).json({success: true, user: user});
      return;
    }

    if (!response) {
      res.status(200).json({success: true, user: {}});
    }
  });
}

module.exports.getUsers = (req, res) => {
  let query = {};

  if (req.query && req.query.text) {
    query = {
      $and: [
        { role: {$ne: 'ADMIN'} },
        { userId: { $regex: req.query.text, $options: 'i'} }
      ]
    };
  }

  if (!req.query || (req.query && !req.query.text)) {
    query = {role: {$ne: 'ADMIN'}};
  }

  User.find(query, (error, response) => {
    if(error) {
      res.status(500).json({status: 'Error', message: 'Error occurred while getting users.'});
      return
    }

    if(response && response.length > 0) {
      const users = [];

      if (response && response.length > 0) {
        for (const user of response) {
          const data = {
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            gender: user.gender,
            status: user.status,
            role: user.role,
            dateOfBirth: user.dateOfBirth,
            mobileNumber: user.mobileNumber,
            addressDetails: user.addressDetails,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            userId: user.userId
          };

          users.push(data);
        }
      }

      res.status(200).json({status: 'Success', users: users});
      return;
    }

    res.status(200).json({status: 'Success', users: []});
  });
}

module.exports.getUserByEmail = (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  User.findOne({email: email}, (error, user) => {
    if (error) {
      res.status(500).json({success: false, message: 'Error occurred while finding user.'});
      return;
    }

    if (!user) {
      res.status(404).json({success: false, message: 'User not found.'});
      return;
    }

    bcryptjs.compare(password, user.password, (error , isMatch) => {
      if (error) {
        res.status(500).json({success: false, message: 'Error occurred while comparing password.'});
        return;
      }

      if (!isMatch) {
        res.status(400).json({success: false, message: 'Password does not match.'});
        return;
      }

      if (isMatch) {
        res.status(200).json({
          success: true,
          message: 'Logged in successfully.',
          user: {
            _id: user._id,
            email: user.email,
            role: user.role
          }
        });
      }
    });
  });
}

module.exports.updateUserStatus = (req, res) => {
  User.findOneAndUpdate({_id: req.params.id}, {status: req.body.status},{}, (error) => {
    if (error) {
      res.status(500).json({success: false, message: 'Error occurred while updating status of user.'});
      return;
    }

    if (!error) {
      res.status(200).json({success: true, message: 'User status updated successfully.'});
    }
  });
}

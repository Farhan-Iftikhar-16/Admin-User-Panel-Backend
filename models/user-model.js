const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');
const config = require('../config/config');
const jwt = require('jsonwebtoken');
const generator = require('generate-password');

const userSchema = mongoose.Schema({
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: false
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
  role: {
    type: String,
    required: true
  },
  addressDetails: {
    type: Object,
    required: false,
  },
  password: {
    type: String,
    required: true
  },
  customer: {
    type: String,
    required: false
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
  User.findOne({email: req.body.email}, async (error, user) => {
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
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        userId: req.body.userId,
        email: req.body.email,
        gender: req.body.gender,
        dateOfBirth: req.body.dateOfBirth,
        mobileNumber: req.body.mobileNumber,
        role: req.body.role,
        addressDetails: req.body.addressDetails,
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const salt = await bcryptjs.genSalt(10);

      if (salt) {
        const temporaryPassword = generator.generate({
          length: 10,
        });
        const hash = await bcryptjs.hash(temporaryPassword, salt);

        if (hash) {
          user.password = hash;
        }

        user.save((error, user)=> {
          if(error) {
            res.status(500).json({success: false, message: 'Error occurred while creating account.'});
            return;
          }

          if(!error) {
            res.status(200).json({success: true, message: 'Account created successfully.'});
            sendNewAccountEmail(user, temporaryPassword);
          }
        });
      }
    }
  });
}

module.exports.updateUser = (req , res) => {
  User.findOneAndUpdate({_id: req.params.id}, {...req.body, updatedAt: new Date()},{}, error => {
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
            role: user.role,
            userId: user.userId,
            customer: user.customer,
            name: user.firstName + ' ' + user.lastName
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

module.exports.sendResetPasswordEmail = (req, res) => {
  User.findOne({email: req.body.email}, (error, response) =>  {
    if (error) {
      res.status(500).json({success: false, message: 'Error occurred while sending reset password email. Please try again.'});
      return;
    }

    if (!response) {
      res.status(500).json({success: false, message: 'User not found with the provided email.'});
      return;
    }

    if (response) {
      const token = jwt.sign(response.toJSON(), config.TOKEN_SECRET, { expiresIn: 3600000 }, null);

      const transporter = config.transporter;

      const mailOptions = {
        from: config.emailFrom,
        to: req.body.email,
        subject: 'Reset Password link',
        html: `<p>Click link below to reset password</p>
               <a href="${config.FRONTEND_URL + 'auth/reset-password/' + token + '/' + response._id}">Reset Password</a>`
      };

      transporter.sendMail(mailOptions).then(() => {
        res.status(200).json({success: true, message: 'Email sent successfully.'});
      }).catch(() => {
        res.status(500).json({success: true, message: 'Error occurred while sending email.'});
      });
    }
  });

}

module.exports.verifyToken = (req, res) => {
  const isValidToken = verifyJsonWebToken(req.body.token);
  if (!isValidToken) {
    res.status(500).json({success: false, message: 'Invalid token.'});
    return;
  }

  res.status(200).json();
}

module.exports.resetPassword = (req, res) => {
  User.findById(req.body.id, (error, response) => {
    if (error) {
      res.status(500).json({success: false, message: 'Error occurred while resetting password.'});
      return;
    }

    if (!response) {
      res.status(500).json({success: false, message: 'User not found.'});
      return;
    }

    const isValidToken = verifyJsonWebToken(req.body.token);
    if (!isValidToken) {
      res.status(500).json({success: false, message: 'Invalid token.'});
      return;
    }

    bcryptjs.genSalt(10, (error, salt) => {
      if (error) {
        res.status(500).json({success: false, message: 'Error occurred while resetting password.'});
        return;
      }

      if (!error) {
        bcryptjs.hash(req.body.password, salt, (error, hash) => {
          if (error) {
            res.status(500).json({success: false, message: 'Error occurred while resetting password.'});
            return;
          }

          User.findByIdAndUpdate(req.body.id, { $set: {password: hash}}, {}, error => {
            if (error) {
              res.status(500).json({success: false, message: 'Error occurred while resetting password.'});
              return;
            }

            if (!error) {
              res.status(200).json({success: true, message: 'Password reset successfully.'});
            }
          });
        });
      }
    });
  });
}

function verifyJsonWebToken(token) {
  return jwt.verify(token, config.TOKEN_SECRET, null,(error) => {
    return !error;
  });
}

function sendNewAccountEmail(user, password) {
  const transporter = config.transporter;
  const token = jwt.sign(user.toJSON(), config.TOKEN_SECRET, { expiresIn: 3600000 }, null);

  const mailOptions = {
    from: config.emailFrom,
    to: user.email,
    subject: 'Account Created Successfully',
    html: `<p>Your account has been created successfully please click the link below to set password for login.Temporary password is ${password}</p>
           <a href="${config.FRONTEND_URL + 'auth/reset-password/' + token + '/' + user._id}" >Set password</a>`
  };

  transporter.sendMail(mailOptions).then();
}

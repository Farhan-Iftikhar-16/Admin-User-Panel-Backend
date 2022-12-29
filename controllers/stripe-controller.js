const config = require("../config/config");
const express = require("express");
const User = require("../models/user-model");
const stripe = require('stripe')(config.STRIPE_SECRET_KEY);
const router = express.Router();

router.post('/create-customer-and-pay-amount', async (req, res) => {
  const value = req.body;
  const customer = await createCustomer(value).catch(error => {
    console.log(error);
    return res.status(500).json({success: false, message: error.raw.message});
  });

  await User.findByIdAndUpdate(value._id, {customer: customer.id}).catch((error) => {
    console.log(error);
    return res.status(500).json({success: false, message: 'Error occurred while while creating customer object.'});
  });

  await stripe.subscriptions.create({
    customer: customer.id,
    items: [
      {
        price: value.default_price,
        quantity: 1
      }
    ],
  }).catch((error) => {
    console.log(error);
    return res.status(500).json({success: false, message: error.raw.message});
  });


  const checkoutSession = await stripe.checkout.sessions.create({
    success_url: 'https://example.com/success',
    line_items: [
      {price: value.default_price, quantity: 1},
    ],
    mode: 'subscription',
  }).catch((error) => {
    console.log(error);
    return res.status(500).json({success: false, message: error.raw.message});
  });

  const product = await stripe.products.retrieve(value.product);

  await stripe.products.update(product.id, {metadata: {checkoutSession: checkoutSession.id}});

  res.status(200).json({success: true, message: 'Payment done successfully', customer: customer.id});
});

router.get('/get-customer-by-id/:id', async (req, res) => {
  const customer = await stripe.customers.retrieve(req.params.id).catch(error => {
    console.log(error);
    return res.status(500).json({success: false, message: error.raw.message});
  });

  res.status(200).json({success: true, customer: customer});
});

router.post('/pay-amount', async (req, res) => {
  await stripe.subscriptions.create({
    customer: req.body.customer,
    items: [
      {
        price: req.body.defaultPrice,
        quantity: 1
      }
    ],
  }).catch((error) => {
    console.log(error);
    return res.status(500).json({success: false, message: error.raw.message});
  });

  const checkoutSession = await stripe.checkout.sessions.create({
    success_url: 'https://example.com/success',
    line_items: [
      {price: req.body.defaultPrice, quantity: 1},
    ],
    mode: 'subscription',
  }).catch((error) => {
    console.log(error);
    return res.status(500).json({success: false, message: error.raw.message});
  });

  const product = await stripe.products.retrieve(req.body.productId);

  await stripe.products.update(product.id, {metadata: {checkoutSession: checkoutSession.id}});

  res.status(200).json({success: true, message: 'Payment done successfully'});

});

router.get('/transactions/:customerId', async (req, res) => {
  const allTransactions = await stripe.balanceTransactions.list().catch((error) => {
    console.log(error);
    return res.status(500).json({success: false, message: error.raw.message});
  });

  const filteredTransactions = []

  for (let transaction of allTransactions.data) {
    const source = await stripe.charges.retrieve(transaction.source);
    console.log(source);

    if (source && source.customer === (req.params.customerId)) {
      filteredTransactions.push(transaction);
    }
  }

  res.status(200).json({success: true, transactions: filteredTransactions});
});

function createCustomer(value) {
  return new Promise((resolve, reject) => {
    stripe.customers.create({
      email: value.email,
      source: value.token,
      name: value.name,
      metadata: {
        id: value._id,
        userId: value.userId
      }
    }).then((customer) => {
      resolve(customer);
    }).catch(() => {
      reject();
    })
  });
}
module.exports = router;

const config = require("../config/config");
const express = require("express");
const User = require("../models/user-model");
const Contract = require("../models/contract-model");
const stripe = require('stripe')(config.STRIPE_SECRET_KEY);
const router = express.Router();

router.post('/create-customer-and-pay-amount', async (req, res) => {
  const value = req.body;
  let customerID = req.body.customer;
  if (!customerID) {
    const customer = await createCustomer(value).catch(error => {
      console.log(error);
      return res.status(500).json({success: false, message: error.raw.message});
    });

    await User.findByIdAndUpdate(value._id, {customer: customer.id}).catch((error) => {
      console.log(error);
      return res.status(500).json({success: false, message: 'Error occurred while while creating customer object.'});
    });

    customerID = customer.id;
  }

  let source;

  if (req.body.customer) {
    source = await stripe.customers.createSource(req.body.customer, {source: req.body.token}).catch(error => {
      console.log(error);
      return res.status(500).json({success: false, message: error.raw.message});
    });
    customerID = req.body.customer;
  }

  if (source) {
    await stripe.subscriptions.create({
      customer: customerID,
      default_source: source.id,
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
  }

  if (!source) {
    await stripe.subscriptions.create({
      customer: customerID,
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
  }

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

  await stripe.products.update(product.id, {metadata: {checkoutSession: checkoutSession.id, contractId: product.metadata.contractId}});

  res.status(200).json({success: true, message: 'Payment done successfully', customer: customerID});
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

  await Contract.findByIdAndUpdate(req.body.contract, {status: 'PAYMENT_COMPLETE'});

  res.status(200).json({success: true, message: 'Payment done successfully'});

});

router.get('/transactions', async (req, res) => {
  const allTransactions = await stripe.balanceTransactions.list().catch((error) => {
    console.log(error);
    return res.status(500).json({success: false, message: error.raw.message});
  });

  if (!req.query || !req.query.customer) {
    for (let transaction of allTransactions.data) {
      const source = await stripe.charges.retrieve(transaction.source);
      transaction.customer = await stripe.customers.retrieve(source.customer);

    }
    res.status(200).json({success: true, transactions: allTransactions.data});
    return;
  }


  const filteredTransactions = []

  for (let transaction of allTransactions.data) {
    const source = await stripe.charges.retrieve(transaction.source);

    if (source && source.customer === (req.query.customer)) {
      filteredTransactions.push(transaction);
    }
  }

  res.status(200).json({success: true, transactions: filteredTransactions});
});

router.get('/subscriptions', async (req, res) => {
  let subscriptions = await stripe.subscriptions.list().catch(error => {
    console.log(error);
    return res.status(500).json({success: false, message: error.raw.message});
  });

  subscriptions = subscriptions.data;

  if (!req.query || !req.query.customer) {
    for (let subscription of subscriptions) {
      subscription.customer = await stripe.customers.retrieve(subscription.customer);
      subscription.product = await stripe.products.retrieve(subscription.plan.product);
    }
    res.status(200).json({success: true, subscriptions: subscriptions});
    return;
  }

  if (subscriptions && subscriptions.length > 0) {
    const filteredSubscriptions = [];

    for (let subscription of subscriptions) {
      if (subscription.customer === req.query.customer) {
        subscription.product = await stripe.products.retrieve(subscription.plan.product);
        filteredSubscriptions.push(subscription);
      }
    }

    res.status(200).json({success: true, subscriptions: filteredSubscriptions});
  }
});

router.get('/canceled-subscriptions', async (req, res) => {
  let subscriptions = await stripe.subscriptions.search({
    query: 'status:\'canceled\'',
  });


  subscriptions = subscriptions.data;

  if (!req.query || !req.query.customer) {
    for (let subscription of subscriptions) {
      subscription.customer = await stripe.customers.retrieve(subscription.customer);
      subscription.product = await stripe.products.retrieve(subscription.plan.product);
    }
    res.status(200).json({success: true, subscriptions: subscriptions});
    return;
  }

  if (subscriptions && subscriptions.length > 0) {
    const filteredSubscriptions = [];

    for (let subscription of subscriptions) {
      if (subscription.customer === req.query.customer) {
        subscription.product = await stripe.products.retrieve(subscription.plan.product);
        filteredSubscriptions.push(subscription);
      }
    }

    res.status(200).json({success: true, subscriptions: filteredSubscriptions});
  }
});

router.delete('/delete-subscription/:id', async (req, res) => {
  await stripe.subscriptions.del(req.params.id).catch(error => {
    console.log(error);
    return res.status(500).json({success: false, message: error.raw.message});
  });



  res.status(200).json({success: true, message: 'Subscription cancelled successfully.'});
});

router.put('/update-default-source', async (req, res) => {
  await stripe.customers.update(req.body.id, {default_source: req.body.card}).catch(error => {
    console.log(error);
    return res.status(500).json({success: false, message: error.raw.message});
  });


  res.status(200).json({success: true, message: 'Default source changed successfully.'});
});

router.get('/get-customer-card/:id', async (req, res) => {
  let cards =  await stripe.customers.listSources(
    req.params.id,
    {object: 'card'}
  );

  cards = cards.data


  res.status(200).json({success: true, cards: cards});
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
    }).catch((error) => {
      console.log(error);
      reject(error);
    })
  });
}

module.exports = router;

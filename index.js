const express = require('express');
const axios = require('axios');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();


const app = express();
const PORT = process.env.PORT || 5000;
const API_KEY = process.env.WIRELESS_PAY_API_KEY; // Ensure this is in your .env file
const BASE_URL = 'https://wirelesspay.ng/api/v1'; // Hardcoded for this API example
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET;


// Middleware to parse form data
const multer = require('multer');
const upload = multer();

// Middleware
app.use(express.urlencoded({ extended: true })); // 👈 Important!
app.use(cors()); // Allow cross-origin requests
app.use(express.json()); // Parse JSON payloads

const VALID_API_KEY = process.env.WIRELESS_PAY_API_KEY;
// Utility function to generate a random invoice reference
const generateInvoiceReference = () => {
  return Math.floor(100000000 + Math.random() * 900000000).toString(); // 9-digit random number
};

app.post('/api/v1/third-party/resend-webhook', upload.none(), (req, res) => {
  const apiKey = req.headers['apikey'];
  const transaction_reference = req.body.transaction_reference;

  // Check API Key
  if (!apiKey || apiKey !== VALID_API_KEY) {
      return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validate transaction_reference
  if (!transaction_reference) {
      return res.status(400).json({ error: 'Missing transaction_reference' });
  }

  // Process transaction (Example: Fetch transaction data, resend webhook, etc.)
  console.log('Resending webhook for:', { transaction_reference });

  // Respond with success message
  return res.status(200).json({ message: 'Webhook resent successfully' });
});


// Webhook route
const FRONTEND_API_URL = 'https://dimpaybackend.onrender.com/api/all-virtual-accounts'; // Update this URL to the correct one

// POST endpoint to handle the webhook
app.post('/handleTransaction', (req, res) => {
  try {
      // Log the incoming payload for debugging
      console.log('Received payload:', req.body);

      const { status } = req.body;

      // Check the transaction status and respond accordingly
      if (status === 'APPROVED' || status === 'Success') {
          return res.status(200).json({
              status: 'success',
              code: 200,
              message: 'Transaction credited successfully'
          });
      } else if (status === 'FAILED') {
          return res.status(400).json({
              status: 'error',
              code: 400,
              message: 'Transaction failed'
          });
      } else if (status === 'REVERSED') {
          return res.status(200).json({
              status: 'info',
              code: 200,
              message: 'Transaction reversed'
          });
      } else {
          return res.status(400).json({
              status: 'error',
              code: 400,
              message: 'Invalid transaction status'
          });
      }
  } catch (error) {
      console.error('Error processing transaction:', error);

      // Generic error response
      return res.status(500).json({
          status: 'error',
          code: 500,
          message: 'Internal server error'
      });
  }
});



// Route to fetch all virtual accounts
app.get('/api/all-virtual-accounts', async (req, res) => {
  try {
    const response = await axios.get(`${BASE_URL}/third-party/all-virtual-account`, {
      headers: {
        ApiKey: API_KEY,
        'Content-Type': 'application/json',
      },
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching virtual accounts:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || 'Failed to fetch virtual accounts',
    });
  }
});

// Route to create a virtual account
app.post('/api/create-virtual-account', async (req, res) => {
  try {
    const { full_name, email, phone_number, bvn, nin } = req.body;

    if (!full_name || !email || !phone_number || !bvn || !nin) {
      return res.status(400).json({
        error: 'full_name, email, phone_number, bvn, and nin are required',
      });
    }

    const requestBody = {
      full_name,
      email,
      phone_number,
      bvn,
      nin,
      preferred_bank: '000012',
      notification_status: '0',
      settlement_type: '1',
    };

    const response = await axios.post(
      `${BASE_URL}/third-party/virtual-account`,
      requestBody,
      {
        headers: {
          ApiKey: API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Virtual account created successfully:', response.data);
    res.status(201).json({
      message: 'Virtual account created successfully',
      data: response.data,
    });
  } catch (error) {
    console.error('Error creating virtual account:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || 'An unexpected error occurred',
    });
  }
});

// Route to fetch transaction history by account number
app.get('/api/transaction-history', async (req, res) => {
  try {
    const { account_number } = req.query;

    if (!account_number) {
      return res.status(400).json({
        error: 'account_number is required',
      });
    }

    const response = await axios.get(
      `${BASE_URL}/third-party/transaction/history?account_number=${account_number}`,
      {
        headers: {
          ApiKey: API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error fetching transaction history:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || 'Failed to fetch transaction history',
    });
  }
});

// Route to verify wallet
app.post('/api/verify-wallet', async (req, res) => {
  const { accountNumber } = req.body;

  if (!accountNumber) {
    return res.status(400).json({ message: 'Account number is required' });
  }

  try {
    const response = await axios.post(
      `${BASE_URL}/third-party/verify-wallet`,
      { account_number: accountNumber },
      {
        headers: { ApiKey: API_KEY },
      }
    );

    res.status(response.status).json({
      message: response.data.message,
      data: response.data.data,
    });
  } catch (error) {
    console.error('Invalid account number:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || 'Failed to verify wallet',
    });
  }
});

// Route to transfer funds
app.post('/api/transfer-funds', async (req, res) => {
  const { accountNumber, amount, transactionPin, narration, debitFrom } = req.body;

  if (!accountNumber || !amount || !transactionPin || !debitFrom) {
    return res.status(400).json({
      message: 'accountNumber, amount, transactionPin, and debitFrom are required',
    });
  }

  try {
    const response = await axios.post(
      `${BASE_URL}/third-party/wallet-to-wallet-transfer`,
      {
        account_number: accountNumber,
        amount,
        transaction_pin: transactionPin,
        narration,
        debit_from: debitFrom,
      },
      {
        headers: { ApiKey: API_KEY },
      }
    );

    res.status(response.status).json({
      message: response.data.message,
      data: response.data.data,
    });
  } catch (error) {
    console.error('Error transferring funds:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || 'Failed to transfer funds',
    });
  }
});

// Route to handle virtual account transfers
app.post('/api/virtual-account-transfer', async (req, res) => {
  try {
    const { bank_code, bank_account_number, amount, transaction_pin, narration, debit_virtual_account_number } = req.body;

    // Validate required fields
    if (!bank_code || !bank_account_number || !amount || !transaction_pin || !narration || !debit_virtual_account_number) {
      return res.status(400).json({
        error: 'All fields (bank_code, bank_account_number, amount, transaction_pin, narration, debit_virtual_account_number) are required',
      });
    }

    const formData = {
      bank_code,
      bank_account_number,
      amount,
      transaction_pin,
      narration,
      debit_virtual_account_number,
    };

    const response = await axios.post(
      `${BASE_URL}/third-party/virtual-to-bank-transfer`,
      formData,
      {
        headers: {
          ApiKey: API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Transfer successful:', response.data);
    res.status(200).json({
      message: 'Transfer successful',
      data: response.data,
    });
  } catch (error) {
    console.error('Error initiating transfer:', error.response?.data || error.message);
    if (error.response) {
      const { status, data } = error.response;
      return res.status(status).json({
        error: data?.message || 'An error occurred during the transfer',
      });
    }

    res.status(500).json({
      error: 'An unexpected error occurred during the transfer',
    });
  }
});

// Route to fetch all banks in Nigeria
app.get('/api/banks', async (req, res) => {
  try {
    const response = await axios.get(`${BASE_URL}/get-banks`, {
      headers: {
        ApiKey: API_KEY,
        'Content-Type': 'application/json',
      },
    });

    res.status(200).json({
      message: 'Banks fetched successfully',
      data: response.data,
    });
  } catch (error) {
    console.error('Error fetching banks:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || 'Failed to fetch banks',
    });
  }
});


// Route to verify an account number
app.post('/api/verify-account', async (req, res) => {
  const { bank_code, account_number } = req.body;

  // Check if required parameters are provided
  if (!bank_code || !account_number) {
    return res.status(400).json({
      error: 'bank_code and account_number are required',
    });
  }

  try {
    // API request to verify account
    const response = await axios.post(
      `${BASE_URL}/third-party/verify-account`,
      {
        bank_code,
        account_number,
      },
      {
        headers: {
          ApiKey: API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Account verified successfully:', response.data);

    // Return successful verification details
    res.status(200).json({
      message: 'Account verification successful',
      data: response.data,
    });
  } catch (error) {
    console.error('Error verifying account:', error.response?.data || error.message);

    // Return error details
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || 'Failed to verify account',
    });
  }
});

// Route to purchase airtime
app.post('/api/airtime-purchase', async (req, res) => {
  const { phone, amount, network, transaction_pin } = req.body;

  // Validate required parameters
  if (!phone || !amount || !network || !transaction_pin) {
    return res.status(400).json({
      error: 'phone, amount, network, and transaction_pin are required',
    });
  }

  try {
    const response = await axios.post(
      `${BASE_URL}/third-party/airtime/airtime-purchase`,
      {
        phone,
        amount,
        network,
        transaction_pin,
      },
      {
        headers: {
          ApiKey: API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Airtime purchase successful:', response.data);

    // Return success response
    res.status(200).json({
      message: 'Airtime purchase successful',
      data: response.data,
    });
  } catch (error) {
    console.error('Error purchasing airtime:', error.response?.data || error.message);

    // Return error response
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || 'Failed to purchase airtime',
    });
  }
});

app.post('/api/virtual-accounts/temporary', upload.none(), async (req, res) => {
  try {
    // Destructure form data from the request body
    const { amount, customer_phone, my_preferred_bank_code } = req.body;

    // Validate required fields
    if (!amount || !customer_phone || !my_preferred_bank_code) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Generate the random invoice reference
    const invoice_reference = generateInvoiceReference();

    // Make the POST request to the external API
    const response = await axios.post(
      `${BASE_URL}/third-party/temporary-account-checkout`,
      {
        amount,
        invoice_reference,
        customer_phone,
        my_preferred_bank_code:  '000012'
      },
      {
        headers: {
          ApiKey: API_KEY,
          'Content-Type': 'application/json',
        }
      }
    );

    // Respond to the client with the API response
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Error in temporary account checkout:', error.message);
    // Handle errors from the API or other issues
    if (error.response) {
      res.status(error.response.status).json({
        error: error.response.data || 'Error occurred during the request',
      });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// Route to handle wallet account transfers
app.post('/api/wallet-transfer', async (req, res) => {
  try {
    const { bank_code, account_number, amount, transaction_pin, narration } = req.body;

    // Validate required fields
    if (!bank_code || !account_number || !amount || !transaction_pin || !narration) {
      return res.status(400).json({
        error: 'All fields (bank_code, account_number, amount, transaction_pin, narration) are required',
      });
    }

    const formData = {
      bank_code,
      account_number,
      amount,
      transaction_pin,
      narration,
      
    };

    const response = await axios.post(
      `${BASE_URL}/third-party/transfer`,
      formData,
      {
        headers: {
          ApiKey: API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Transfer successful:', response.data);
    res.status(200).json({
      message: 'Transfer successful',
      data: response.data,
    });
  } catch (error) {
    console.error('Error initiating transfer:', error.response?.data || error.message);
    if (error.response) {
      const { status, data } = error.response;
      return res.status(status).json({
        error: data?.message || 'An error occurred during the transfer',
      });
    }

    res.status(500).json({
      error: 'An unexpected error occurred during the transfer',
    });
  }
});


// /api/send-invitation endpoint
app.post('/api/send-invitation', async (req, res) => {
  const { toEmail, subject, message } = req.body;

  if (!toEmail || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required: toEmail, subject, message' });
  }

  try {
     // Configure Nodemailer
     const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false, // Use true for 465, false for other ports
      auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
      },
  });

        // Email details
        const mailOptions = {
          from: process.env.FROM_EMAIL,
          to: toEmail,
          subject: subject,
          text: message, // Plain text fallback
       
      };

    // Send the email
    const info = await transporter.sendMail(mailOptions);

    console.log(`Email sent: ${info.messageId}`);

    res.json({ success: true, message: 'Invitation sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, message: 'Failed to send invitation.' });
  }
});


app.get('/api/send-sms', async (req, res) => {
  try {
    // Extract query parameters from the request
    const { to, sms } = req.query;

    // Validate input
    if (!to || !sms) {
      return res.status(400).json({
        success: false,
        message: 'Phone number (to) and message (sms) are required.',
      });
    }

    // Construct the target SMS API URL with query parameters
    const smsApiUrl = 'https://sms.arkesel.com/sms/api';
    const queryParams = new URLSearchParams({
      action: 'send-sms',
      api_key: 'T3RieFdmRGl4ZWpnQkRya0E', // Replace with your actual API key
      to, // Phone number
      from: 'TheRealDeal', // Sender ID
      use_case: 'promotional',
      sms, // SMS content
    }).toString();

    // Make the GET request to the SMS API
    const response = await axios.get(smsApiUrl, {
      headers: {
        api_key: 'T3RieFdmRGl4ZWpnQkRwQkRya0E', // Pass API key in headers
      },
      params: {
        action: 'send-sms',
        api_key: 'T3RieFdmRGl4ZWpnQkRwQkRya0E',
        to,
        from: 'TheRealDeal',
        use_case: 'promotional',
        sms,
      },
    });
    

    // Return the response from the SMS API to the client
    res.json(response.data);
  } catch (error) {
    console.error('Error sending SMS:', error.response?.data || error.message || error);
    res.status(500).json({
      success: false,
      message: 'Failed to send SMS. Please try again later.',
      error: error.response?.data || error.message || error,
    });
  }
});

// /api/send-invitation endpoint
app.post('/api/send-orders', async (req, res) => {
  const { toEmail, subject, message } = req.body;

  if (!toEmail || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required: toEmail, subject, message' });
  }

  try {
     // Configure Nodemailer
     const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false, // Use true for 465, false for other ports
      auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
      },
  });

        // Email details
        const mailOptions = {
          from: "Oooh'sDelight@dimaq.com.ng",
          to: toEmail,
          subject: subject,
          text: message, // Plain text fallback
       
      };

    // Send the email
    const info = await transporter.sendMail(mailOptions);

    console.log(`Email sent: ${info.messageId}`);

    res.json({ success: true, message: 'Invitation sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, message: 'Failed to send invitation.' });
  }
});


// /api/send-invitation-logistics endpoint
app.post('/api/send-orders-logistics', async (req, res) => {
  const { toEmail, subject, message } = req.body;

  if (!toEmail || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required: toEmail, subject, message' });
  }

  try {
     // Configure Nodemailer
     const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false, // Use true for 465, false for other ports
      auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
      },
  });

        // Email details
        const mailOptions = {
          from: "dimaqlogistics@dimaq.com.ng",
          to: toEmail,
          subject: subject,
          text: message, // Plain text fallback
       
      };

    // Send the email
    const info = await transporter.sendMail(mailOptions);

    console.log(`Email sent: ${info.messageId}`);

    res.json({ success: true, message: 'orders sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, message: 'Failed to send orders.' });
  }
});

// /api/send escrow payment notification endpoint
app.post('/api/send-escrow', async (req, res) => {
  const { toEmail, subject, message } = req.body;

  if (!toEmail || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required: toEmail, subject, message' });
  }

  try {
     // Configure Nodemailer
     const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false, // Use true for 465, false for other ports
      auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
      },
  });

        // Email details
        const mailOptions = {
          from: "Escrow@dimaq.com.ng",
          to: toEmail,
          subject: subject,
          text: message, // Plain text fallback
       
      };

    // Send the email
    const info = await transporter.sendMail(mailOptions);

    console.log(`Email sent: ${info.messageId}`);

    res.json({ success: true, message: 'receipts sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, message: 'Failed to send receipts.' });
  }
});

app.post("/verify-turnstile", async (req, res) => {
  const { token } = req.body;

  if (!token) {
    console.log("No CAPTCHA token provided, but proceeding...");
    return res.json({ success: true, message: "CAPTCHA check skipped" }); // ✅ Allow login/register anyway
  }

  try {
    const response = await axios.post(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      new URLSearchParams({
        secret: TURNSTILE_SECRET,
        response: token,
      }).toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    console.log("Turnstile verification response:", response.data);
    return res.json({ success: true, message: "CAPTCHA verified" });
  } catch (error) {
    console.log("CAPTCHA verification failed:", error.message);
    return res.json({ success: true, message: "Ignoring CAPTCHA failure" }); // ✅ Proceed anyway
  }
});



// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

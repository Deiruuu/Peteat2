const axios = require('axios');

async function testPetTreatmentsAPI() {
  try {
    // First, try to get a new token by logging in
    console.log('Attempting to login...');
    try {
      const loginResponse = await axios.post('http://localhost:5050/api/users/login', {
        email: 'josephsabroso2004@gmail.com',
        password: '123456' // Common default password, worth a try
      });
      
      if (loginResponse.data && loginResponse.data.token) {
        console.log('Login successful, got token');
        var token = loginResponse.data.token;
        var clinicId = loginResponse.data.user.id;
      }
    } catch (loginError) {
      console.log('Login failed, using hardcoded token');
      // Fallback to hardcoded token
      var token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4NWFlOTIzNDI3NTJiYzZmM2NjZDgzNCIsImlhdCI6MTcxNzE5NTUzMCwiZXhwIjoxNzE3MjgxOTMwfQ.Qj6dxDYVuMSvqIWd1yjLNGQXJJFnZc_Lm0xNxCL0Oj0';
      var clinicId = '685ae92342752bc6f3ccd834';
    }
    
    console.log('Testing GET /api/pet-treatments/clinic/:clinicId with clinic ID:', clinicId);
    console.log('Using token:', token);
    
    const response = await axios.get(`http://localhost:5050/api/pet-treatments/clinic/${clinicId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('API Response Status:', response.status);
    console.log('API Response Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('API Error:', error.message);
    if (error.response) {
      console.error('Error Status:', error.response.status);
      console.error('Error Data:', error.response.data);
    }
  }
}

testPetTreatmentsAPI(); 
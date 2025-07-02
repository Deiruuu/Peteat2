export const isValidPHPhoneNumber = (input: string): boolean => {
  // Valid Philippine mobile number starting with +63 followed by exactly 10 digits
  // Example: +639171234567
  const regex = /^\+63\d{10}$/;
  return regex.test(input);
};

export const isValidEmail = (email: string): boolean => {
  // Simple email regex (RFC-5322 simplified)
  return /^\S+@\S+\.\S+$/.test(email);
}; 
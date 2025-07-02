import React, { createContext, useState, useContext, ReactNode } from 'react';

// Define user role type - removed admin role
export type UserRole = 'user' | 'clinic';

// Define the context type
type UserRoleContextType = {
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
};

// Create the context with a default value
const UserRoleContext = createContext<UserRoleContextType | undefined>(undefined);

// Provider component
export const UserRoleProvider = ({ children }: { children: ReactNode }) => {
  // Default to user (pet owner) role
  const [userRole, setUserRole] = useState<UserRole>('user');

  return (
    <UserRoleContext.Provider value={{ userRole, setUserRole }}>
      {children}
    </UserRoleContext.Provider>
  );
};

// Custom hook to use the user role context
export const useUserRole = (): UserRoleContextType => {
  const context = useContext(UserRoleContext);
  if (context === undefined) {
    throw new Error('useUserRole must be used within a UserRoleProvider');
  }
  return context;
}; 

export default UserRoleProvider;

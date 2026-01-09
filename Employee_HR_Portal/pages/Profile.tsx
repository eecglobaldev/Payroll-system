import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { Mail, Phone, MapPin, Building, Calendar, Shield, AlertCircle, CheckCircle } from 'lucide-react';
import { getEmployeeProfile, updateEmployeeProfile, changePassword } from '../services/api';

const Profile: React.FC = () => {
  const { user: authUser, logout } = useAuth();
  const [user, setUser] = useState(authUser);
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Password change form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setProfileLoading(true);
        const profile = await getEmployeeProfile();
        setUser(profile);
      } catch (err) {
        console.error('Failed to fetch profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setProfileLoading(false);
      }
    };

    if (authUser) {
      fetchProfile();
    }
  }, [authUser]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long');
      return;
    }

    try {
      setLoading(true);
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Clear success message after 3 seconds
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (err) {
      console.error('Password change failed:', err);
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  if (profileLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-600">Loading profile...</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-64 bg-gray-100 rounded-lg"></div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-600">View your personal information and manage account security.</p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center space-x-3">
          <AlertCircle className="text-rose-600" size={20} />
          <p className="text-sm text-rose-700 font-semibold">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center space-x-3">
          <CheckCircle className="text-green-600" size={20} />
          <p className="text-sm text-green-700 font-semibold">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <div className="flex flex-col items-center text-center">
              <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-4 border-4 border-white shadow-sm">
                <span className="text-3xl font-bold">
                  {user?.name ? user.name.split(' ').map(n => n[0]).join('') : 'E'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-900">{user?.name || 'Employee'}</h2>
              <p className="text-sm text-blue-600 font-medium">{user?.designation || 'Employee'}</p>
              <div className="mt-2 text-xs font-semibold text-gray-500 px-2 py-0.5 bg-gray-100 rounded-full">
                {user?.employeeCode || 'N/A'}
              </div>
            </div>

            <div className="mt-8 space-y-4 border-t border-gray-100 pt-6">
               <InfoRow icon={<Mail size={16} />} label="Email Address" value={user?.email || 'N/A'} />
               <InfoRow icon={<Phone size={16} />} label="Phone Number" value={user?.phone || 'N/A'} />
               <InfoRow icon={<Building size={16} />} label="Department" value={user?.department || 'N/A'} />
               <InfoRow icon={<Calendar size={16} />} label="Member Since" value={user?.joinDate ? new Date(user.joinDate).toLocaleDateString() : 'N/A'} />
            </div>
          </Card>

          <Card title="Work Location">
             <div className="flex items-start space-x-3">
               <MapPin className="text-gray-400 mt-1" size={18} />
               <p className="text-sm text-gray-700">
                 Global HQ, Block B<br />
                 Innovation Park, Suite 402<br />
                 Palo Alto, CA 94304
               </p>
             </div>
          </Card>
        </div>

        {/* Change Password Card */}
        <div className="lg:col-span-2">
          <Card title="Account Security">
            <div className="flex items-center space-x-4 mb-8 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="p-3 bg-white rounded-lg shadow-sm text-blue-600">
                 <Shield size={24} />
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Change Password</h4>
                <p className="text-sm text-gray-600">Update your account password regularly to keep your information secure.</p>
              </div>
            </div>

            {passwordError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg">
                <p className="text-sm text-rose-700 font-semibold">{passwordError}</p>
              </div>
            )}

            {passwordSuccess && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700 font-semibold">Password updated successfully!</p>
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="max-w-md space-y-5">
              <Input 
                label="Current Password" 
                type="password" 
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <Input 
                label="New Password" 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
              <Input 
                label="Confirm New Password" 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
              <div className="pt-4 flex space-x-3">
                 <Button type="submit" disabled={loading}>
                   {loading ? 'Updating...' : 'Save Password'}
                 </Button>
                 <Button 
                   type="button" 
                   variant="ghost"
                   onClick={() => {
                     setCurrentPassword('');
                     setNewPassword('');
                     setConfirmPassword('');
                     setPasswordError(null);
                     setPasswordSuccess(false);
                   }}
                 >
                   Cancel
                 </Button>
              </div>
            </form>
          </Card>
          
          <div className="mt-8 p-6 bg-yellow-50 border border-yellow-200 rounded-xl">
             <h4 className="font-bold text-yellow-800 flex items-center mb-2">
                <AlertCircle size={18} className="mr-2" />
                Profile Editing
             </h4>
             <p className="text-sm text-yellow-700">
                To update your basic information (Name, Department, Email, etc.), please contact your HR representative. These fields are managed by the administration.
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const InfoRow = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center space-x-3">
    <div className="text-gray-400">{icon}</div>
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
      <p className="text-sm text-gray-800 font-medium">{value}</p>
    </div>
  </div>
);

export default Profile;

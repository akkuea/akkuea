'use client';

import type React from 'react';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ProfileAvatar } from './profile-avatar';
import { ProfileForm } from './profile-form';
import { RoleSelector } from './role-selector';
import { ActionButtons } from './action-buttons';

const roles = [
  { id: 'teacher', label: 'Teacher' },
  { id: 'director', label: 'Director' },
  { id: 'student', label: 'Student' },
  { id: 'designer', label: 'Designer' },
];

export default function EditProfilePage() {
  const router = useRouter();
  const [name, setName] = useState('Jefferson Calderon');
  const [username, setUsername] = useState('xJeffx23');
  const [bio, setBio] = useState(
    "I'm a crack designer, I like software engineering and also mixing as a DJ."
  );
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['student', 'designer']);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      console.log('Profile updated:', { name, username, bio, selectedRoles });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      router.push('/profile');
    } catch (error) {
      console.error('Error updating profile:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="px-8 py-8">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-primary">Edit Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <ProfileAvatar />
              <ProfileForm
                name={name}
                username={username}
                bio={bio}
                onNameChange={setName}
                onUsernameChange={setUsername}
                onBioChange={setBio}
              />
              <RoleSelector
                roles={roles}
                selectedRoles={selectedRoles}
                onRoleChange={handleRoleChange}
              />
              <ActionButtons onCancel={() => router.push('/')} isSubmitting={isSubmitting} />
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

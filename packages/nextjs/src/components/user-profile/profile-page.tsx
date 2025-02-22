"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { ProfileAvatar } from "./ ProfileAvatar"
import { ProfileForm } from "./ProfileForm"
import { RoleSelector } from "./RoleSelector"
import { ActionButtons } from "./ActionButtons"


const roles = [
  { id: "teacher", label: "Teacher" },
  { id: "director", label: "Director" },
  { id: "student", label: "Student" },
  { id: "designer", label: "Designer" },
]

export default function EditProfilePage() {
  const router = useRouter()
  const [name, setName] = useState("Jefferson Calderon")
  const [username, setUsername] = useState("xJeffx23")
  const [bio, setBio] = useState("I'm a crack designer, I like software engineering and also mixing as a DJ.")
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["student", "designer"])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      // Here you would typically send the updated profile data to your backend
      console.log("Profile updated:", { name, username, bio, selectedRoles })
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      router.push("/profile")
    } catch (error) {
      console.error("Error updating profile:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRoleChange = (roleId: string) => {
    setSelectedRoles((prev) => 
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId]
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <div className="container mx-auto px-4 py-8 max-w-lg">
        <Card className="bg-white dark:bg-black dark:border-gray-800">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-[#38B2AC]">Edit Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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
              <ActionButtons
                onCancel={() => router.push("/profile")}
                isSubmitting={isSubmitting}
              />
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
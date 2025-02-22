import { User } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

export const ProfileAvatar = () => {
  return (
    <div className="flex items-center space-x-4">
      <Avatar className="w-24 h-24">
        <AvatarImage src="/placeholder-user.jpg" alt="Profile picture" />
        <AvatarFallback className="bg-muted">
          <User className="w-12 h-12" />
        </AvatarFallback>
      </Avatar>
      <Button type="button" variant="outline">
        Change Profile Picture
      </Button>
    </div>
  )
}

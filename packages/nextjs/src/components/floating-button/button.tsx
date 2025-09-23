'use client';
import type React from 'react';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { PlusCircle, ImageIcon, Video } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function CreatePostModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('text');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle post creation logic here
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="fixed bottom-6 md:right-20 right-16 z-50 rounded-full bg-primary hover:bg-primary/80 text-white shadow-lg">
          <PlusCircle className="w-6 h-6 mr-2" />
          Create Post
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] bg-card border border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary">Create a new post</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="text" className="w-full" onValueChange={(value) => setActiveTab(value)}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="text">Text</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="link">Link</TabsTrigger>
          </TabsList>
          <form onSubmit={handleSubmit} className="space-y-4">
            <TabsContent value="text">
              <Textarea
                placeholder="What's on your mind?"
                className="min-h-[150px] resize-none bg-card text-foreground border-border"
              />
            </TabsContent>
            <TabsContent value="media">
              <div className="grid gap-4">
                <Label
                  htmlFor="image"
                  className="text-primary flex items-center gap-2 cursor-pointer"
                >
                  <ImageIcon className="w-5 h-5" />
                  Upload Image
                </Label>
                <Input id="image" type="file" accept="image/*" className="hidden" />
                <Label
                  htmlFor="video"
                  className="text-primary flex items-center gap-2 cursor-pointer"
                >
                  <Video className="w-5 h-5" />
                  Upload Video
                </Label>
                <Input id="video" type="file" accept="video/*" className="hidden" />
              </div>
            </TabsContent>
            <TabsContent value="link">
              <Input
                type="url"
                placeholder="https://example.com"
                className="bg-card text-foreground border-border"
              />
            </TabsContent>
            {activeTab === 'text' && (
              <>
                <div>
                  <Label htmlFor="category" className="text-primary">
                    Category
                  </Label>
                  <Select>
                    <SelectTrigger className="w-full mt-1 bg-card text-foreground border-border">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      <SelectItem value="university">University</SelectItem>
                      <SelectItem value="highschool">High School</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="subject" className="text-primary">
                    Subject
                  </Label>
                  <Input
                    id="subject"
                    type="text"
                    placeholder="e.g. Data Structures and Algorithms"
                    className="mt-1 bg-card text-foreground border-border"
                  />
                </div>
              </>
            )}
            <Button type="submit" className="w-full bg-primary hover:bg-primary/80 text-white">
              Post
            </Button>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export const UploadLabel = () => {
  return (
    <div className="flex items-center gap-2">
      <ImageIcon className="h-4 w-4" aria-hidden="true" />
      <span>Upload</span>
    </div>
  );
};

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
import { PlusCircle, Image as ImageIcon, Video } from 'lucide-react';
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
        <Button className="fixed bottom-6 right-6 rounded-full bg-[#00ced1] hover:bg-[#00a3a3] text-white shadow-lg">
          <PlusCircle className="w-6 h-6 mr-2" />
          Create Post
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[550px] bg-white dark:bg-black border border-gray-200 dark:border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#00ced1] dark:text-[#008b8b]">
            Create a new post
          </DialogTitle>
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
                className="min-h-[150px] resize-none bg-white dark:bg-black text-gray-900 dark:text-white border-gray-200 dark:border-gray-700"
              />
            </TabsContent>
            <TabsContent value="media">
              <div className="grid gap-4">
                <Label
                  htmlFor="image"
                  className="text-[#00ced1] dark:text-[#00ced1] flex items-center gap-2 cursor-pointer"
                >
                  <ImageIcon className="w-5 h-5" />
                  Upload Image
                </Label>
                <Input id="image" type="file" accept="image/*" className="hidden" />
                <Label
                  htmlFor="video"
                  className="text-[#00ced1] dark:text-[#00ced1] flex items-center gap-2 cursor-pointer"
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
                className="bg-white dark:bg-black text-gray-900 dark:text-white border-gray-200 dark:border-gray-700"
              />
            </TabsContent>
            {activeTab === 'text' && (
              <>
                <div>
                  <Label htmlFor="category" className="text-[#00ced1] dark:text-[#00ced1]">
                    Category
                  </Label>
                  <Select>
                    <SelectTrigger className="w-full mt-1 bg-white dark:bg-black text-gray-900 dark:text-white border-gray-200 dark:border-gray-700">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-black border-gray-200 dark:border-gray-800">
                      <SelectItem value="university">University</SelectItem>
                      <SelectItem value="highschool">High School</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="subject" className="text-[#00ced1] dark:text-[#00ced1]">
                    Subject
                  </Label>
                  <Input
                    id="subject"
                    type="text"
                    placeholder="e.g. Data Structures and Algorithms"
                    className="mt-1 bg-white dark:bg-black text-gray-900 dark:text-white border-gray-200 dark:border-gray-700"
                  />
                </div>
              </>
            )}
            <Button type="submit" className="w-full bg-[#00ced1] hover:bg-[#00a3a3] text-white">
              Post
            </Button>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

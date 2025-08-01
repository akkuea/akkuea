'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, Search, Plus, MessageCircle, TrendingUp, User } from 'lucide-react';
import { toast } from 'sonner';
import DiscussionItem from './DiscussionItem';

// Mock data
const allCommunities = [
  {
    id: 1,
    name: 'Web Programming',
    description:
      'Community for web developers, where we share knowledge about HTML, CSS, JavaScript and modern frameworks.',
    tags: ['Development', 'Frontend', 'Backend'],
    members: 1245,
    posts: 324,
    joined: false,
    image: '/placeholder.svg?height=80&width=80&text=WP',
  },
  {
    id: 2,
    name: 'Data Science',
    description:
      'Space to share knowledge about data analysis, machine learning, statistics and visualization.',
    tags: ['Python', 'R', 'Statistics'],
    members: 876,
    posts: 198,
    joined: false,
    image: '/placeholder.svg?height=80&width=80&text=DS',
  },
  {
    id: 3,
    name: 'UX/UI Design',
    description:
      'Community focused on user experience and interface design, sharing best practices and design trends.',
    tags: ['Design', 'UX', 'UI', 'Figma'],
    members: 542,
    posts: 156,
    joined: true,
    image: '/placeholder.svg?height=80&width=80&text=UX',
  },
  {
    id: 4,
    name: 'Mobile Development',
    description:
      'Discussion space for mobile app development across iOS, Android, and cross-platform solutions.',
    tags: ['iOS', 'Android', 'React Native', 'Flutter'],
    members: 689,
    posts: 203,
    joined: true,
    image: '/placeholder.svg?height=80&width=80&text=MD',
  },
  {
    id: 5,
    name: 'DevOps & Cloud',
    description:
      'Community for DevOps engineers and cloud architects to share infrastructure knowledge.',
    tags: ['AWS', 'Docker', 'Kubernetes', 'CI/CD'],
    members: 423,
    posts: 89,
    joined: false,
    image: '/placeholder.svg?height=80&width=80&text=DC',
  },
  {
    id: 6,
    name: 'Artificial Intelligence',
    description: 'Explore the latest in AI, machine learning, and deep learning technologies.',
    tags: ['AI', 'ML', 'Deep Learning', 'Neural Networks'],
    members: 1156,
    posts: 267,
    joined: false,
    image: '/placeholder.svg?height=80&width=80&text=AI',
  },
];

const discussions = [
  {
    id: 1,
    title: 'What is the best framework for web development in 2023?',
    author: 'Maria Garcia',
    community: 'Web Programming',
    timestamp: '2 hours ago',
    comments: 34,
    unread: true,
    avatar: '/placeholder.svg?height=32&width=32&text=MG',
  },
  {
    id: 2,
    title: 'Advanced techniques for multidimensional data visualization',
    author: 'Carlos Rodriguez',
    community: 'Data Science',
    timestamp: '5 hours ago',
    comments: 18,
    unread: true,
    avatar: '/placeholder.svg?height=32&width=32&text=CR',
  },
  {
    id: 3,
    title: 'Design principles to improve accessibility in mobile applications',
    author: 'Ana Lopez',
    community: 'UX/UI Design',
    timestamp: '1 day ago',
    comments: 27,
    unread: false,
    avatar: '/placeholder.svg?height=32&width=32&text=AL',
  },
  {
    id: 4,
    title: 'Setting up CI/CD pipelines with GitHub Actions',
    author: 'David Kim',
    community: 'DevOps & Cloud',
    timestamp: '2 days ago',
    comments: 15,
    unread: false,
    avatar: '/placeholder.svg?height=32&width=32&text=DK',
  },
  {
    id: 5,
    title: 'Flutter vs React Native: Performance comparison 2024',
    author: 'Sarah Johnson',
    community: 'Mobile Development',
    timestamp: '3 days ago',
    comments: 42,
    unread: false,
    avatar: '/placeholder.svg?height=32&width=32&text=SJ',
  },
];

export default function Communities() {
  const [searchQuery, setSearchQuery] = useState('');
  const [communities, setCommunities] = useState(allCommunities);
  const [activeTab, setActiveTab] = useState('discover');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCommunity, setNewCommunity] = useState({
    name: '',
    description: '',
    tags: '',
    visibility: 'public',
  });

  const filteredCommunities = communities.filter(
    (community) =>
      community.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      community.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const joinedCommunities = communities.filter((community) => community.joined);
  const joinedDiscussions = discussions.filter((discussion) =>
    joinedCommunities.some((community) => community.name === discussion.community)
  );

  const handleJoinCommunity = (communityId: number) => {
    setCommunities((prev) =>
      prev.map((community) =>
        community.id === communityId
          ? { ...community, joined: true, members: community.members + 1 }
          : community
      )
    );
    toast.success("You've successfully joined the community!");
  };

  const handleLeaveCommunity = (communityId: number) => {
    setCommunities((prev) =>
      prev.map((community) =>
        community.id === communityId
          ? { ...community, joined: false, members: community.members - 1 }
          : community
      )
    );
    toast.success("You've left the community.");
  };

  const handleCreateCommunity = () => {
    if (!newCommunity.name || !newCommunity.description) {
      toast.error('Please fill in all required fields.');
      return;
    }

    const community = {
      id: communities.length + 1,
      name: newCommunity.name,
      description: newCommunity.description,
      tags: newCommunity.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      members: 1,
      posts: 0,
      joined: true,
      image: `/placeholder.svg?height=80&width=80&text=${newCommunity.name.substring(0, 2).toUpperCase()}`,
    };

    setCommunities((prev) => [...prev, community]);
    setNewCommunity({ name: '', description: '', tags: '', visibility: 'public' });
    setIsCreateModalOpen(false);
    toast.success('Your new community has been created successfully!');
  };

  const CommunityCard = ({
    community,
    showLeaveButton = false,
  }: {
    community: (typeof allCommunities)[0];
    showLeaveButton?: boolean;
  }) => (
    <Card className="group hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-gray-200 rounded-lg flex-shrink-0 flex items-center justify-center">
            <Image
              src={community.image || '/placeholder.svg'}
              alt={community.name}
              width={64}
              height={64}
              className="w-full h-full object-cover rounded-lg"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-foreground mb-2">{community.name}</h3>
                <p className="text-muted text-sm mb-3 line-clamp-2">{community.description}</p>
                <div className="flex flex-wrap gap-1 mb-3">
                  {community.tags.map((tag, index) => (
                    <Badge
                      key={index}
                      variant="secondary"
                      className="text-xs bg-primary/10 text-primary hover:bg-primary/20"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted">
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {community.members} members
                  </span>
                  <span>{community.posts} posts</span>
                </div>
              </div>
              <div className="flex-shrink-0">
                {showLeaveButton ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleLeaveCommunity(community.id)}
                    className="text-destructive border-destructive/20 hover:bg-destructive/10"
                  >
                    Leave
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleJoinCommunity(community.id)}
                    disabled={community.joined}
                    className="bg-primary hover:bg-primary/80 text-white"
                  >
                    {community.joined ? 'Joined' : 'Join'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );


  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Communities</h1>
        </div>
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/80 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Create Community
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Community</DialogTitle>
              <DialogDescription>
                {'Create a new community to bring people together around shared interests.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={newCommunity.name}
                  onChange={(e) => setNewCommunity((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter community name"
                />
              </div>
              <div>
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={newCommunity.description}
                  onChange={(e) =>
                    setNewCommunity((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Describe your community"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={newCommunity.tags}
                  onChange={(e) => setNewCommunity((prev) => ({ ...prev, tags: e.target.value }))}
                  placeholder="Enter tags separated by commas"
                />
              </div>
              <div>
                <Label htmlFor="visibility">Visibility</Label>
                <Select
                  value={newCommunity.visibility}
                  onValueChange={(value) =>
                    setNewCommunity((prev) => ({ ...prev, visibility: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Private</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateCommunity} className="bg-primary hover:bg-primary/80">
                Create Community
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted w-4 h-4" />
        <Input
          placeholder="Search communities..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="discover" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Discover
          </TabsTrigger>
          <TabsTrigger value="your-communities" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Your Communities
          </TabsTrigger>
          <TabsTrigger value="discussions" className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" />
            Discussions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="discover" className="space-y-4">
          {filteredCommunities.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted">{'No communities found matching your search.'}</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredCommunities.map((community) => (
                <CommunityCard key={community.id} community={community} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="your-communities" className="space-y-4">
          {joinedCommunities.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted">{"You haven't joined any communities yet."}</p>
              <Button
                variant="outline"
                className="mt-4 bg-transparent"
                onClick={() => setActiveTab('discover')}
              >
                Discover Communities
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {joinedCommunities.map((community) => (
                <CommunityCard key={community.id} community={community} showLeaveButton />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="discussions" className="space-y-4">
          {joinedDiscussions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted">{'No discussions from your communities.'}</p>
              <p className="text-muted/70 text-sm mt-2">
                {'Join communities to see their discussions here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {joinedDiscussions.map((discussion) => (
                <DiscussionItem key={discussion.id} discussion={discussion} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

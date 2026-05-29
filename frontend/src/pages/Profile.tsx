import { useState, useEffect } from "react";
import MainLayout from "@/components/layouts/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { uploadProfilePicture } from "@/services/profileApi";
import { Loader2, Upload, User, Mail, Building, Shield, Key } from "lucide-react";

const Profile = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Mock user data - in a real app this would come from a context or API
  const [userData, setUserData] = useState({
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    company: "Acme Corp",
    role: "Administrator"
  });

  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.currentTarget.files?.[0] ?? null;
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please choose an image file (JPG, PNG).",
        variant: "destructive"
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Max file size is 5 MB.",
        variant: "destructive"
      });
      return;
    }

    setProfileFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!profileFile) return;

    setIsLoading(true);
    try {
      await uploadProfilePicture(profileFile);
      toast({
        title: "Success",
        description: "Profile picture updated successfully.",
      });
      setProfileFile(null);
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: "Failed to upload profile picture. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved.",
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <MainLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Profile Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account settings and preferences.</p>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="rounded-none border border-border" style={{ background: "rgba(255,255,255,0.03)" }}>
            <TabsTrigger value="general" className="data-[state=active]:bg-[rgba(181,196,90,0.1)] data-[state=active]:text-primary text-muted-foreground">General</TabsTrigger>
            <TabsTrigger value="security" className="data-[state=active]:bg-[rgba(181,196,90,0.1)] data-[state=active]:text-primary text-muted-foreground">Security</TabsTrigger>
            <TabsTrigger value="api-keys" className="data-[state=active]:bg-[rgba(181,196,90,0.1)] data-[state=active]:text-primary text-muted-foreground">API Keys</TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-[rgba(181,196,90,0.1)] data-[state=active]:text-primary text-muted-foreground">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            {/* Profile Picture Card */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Profile Picture</CardTitle>
                <CardDescription className="text-muted-foreground">Upload a professional portrait for your profile.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-6">
                <Avatar className="h-24 w-24 border-2 border-[#B5C45A]/30">
                  <AvatarImage src={previewUrl || "https://github.com/shadcn.png"} />
                  <AvatarFallback className="text-2xl bg-white/10 text-foreground">JD</AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      id="picture-upload"
                      onChange={handleProfilePictureChange}
                    />
                    <Label
                      htmlFor="picture-upload"
                      className="cursor-pointer inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-white/10 text-foreground hover:bg-white/20 h-10 px-4 py-2"
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Select Image
                    </Label>
                    {profileFile && (
                      <Button onClick={handleUpload} disabled={isLoading} className="text-[var(--color-accent-fg)] font-semibold hover:opacity-90" style={{ background: "var(--color-accent)", borderRadius: 4, border: "none" }}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Upload
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    JPG or PNG. Max 5MB.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Personal Information Card */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Personal Information</CardTitle>
                <CardDescription className="text-muted-foreground">Update your personal details.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-foreground">First Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                        <Input
                          id="firstName"
                          value={userData.firstName}
                          onChange={(e) => setUserData({...userData, firstName: e.target.value})}
                          className="pl-10 border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-[#B5C45A]/50"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-foreground">Last Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                        <Input
                          id="lastName"
                          value={userData.lastName}
                          onChange={(e) => setUserData({...userData, lastName: e.target.value})}
                          className="pl-10 border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-[#B5C45A]/50"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                      <Input
                        id="email"
                        type="email"
                        value={userData.email}
                        onChange={(e) => setUserData({...userData, email: e.target.value})}
                        className="pl-10 border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-[#B5C45A]/50"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company" className="text-foreground">Company</Label>
                    <div className="relative">
                      <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                      <Input
                        id="company"
                        value={userData.company}
                        onChange={(e) => setUserData({...userData, company: e.target.value})}
                        className="pl-10 border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-[#B5C45A]/50"
                      />
                    </div>
                  </div>

                  <div className="pt-4">
                    <Button type="submit" disabled={isLoading} className="text-[var(--color-accent-fg)] font-semibold hover:opacity-90" style={{ background: "var(--color-accent)", borderRadius: 4, border: "none" }}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-foreground">Security Settings</CardTitle>
                <CardDescription className="text-muted-foreground">Manage your password and security preferences.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border border-border" style={{ background: "rgba(255,255,255,0.02)", borderRadius: 3 }}>
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-[rgba(181,196,90,0.08)]" style={{ borderRadius: 3 }}>
                      <Key className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Password</p>
                      <p className="text-sm text-muted-foreground">Last changed 3 months ago</p>
                    </div>
                  </div>
                  <Button variant="outline" className="border-white/20 hover:bg-white/10 text-foreground bg-transparent">Change Password</Button>
                </div>

                <div className="flex items-center justify-between p-4 border border-border" style={{ background: "rgba(255,255,255,0.02)", borderRadius: 3 }}>
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-[rgba(181,196,90,0.08)]" style={{ borderRadius: 3 }}>
                      <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Two-Factor Authentication</p>
                      <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                    </div>
                  </div>
                  <Button variant="outline" className="border-white/20 hover:bg-white/10 text-foreground bg-transparent">Enable 2FA</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Profile;

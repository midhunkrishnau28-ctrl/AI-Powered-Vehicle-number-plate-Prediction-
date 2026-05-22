import { useState } from "react";
import { useAuth, useUpdateUser } from "@/hooks/use-auth";
import { LayoutShell } from "@/components/layout-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { User, Mail, Lock, Camera, Loader2, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const settingsSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    email: z.string().email("Invalid email address"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
});

export default function Settings() {
    const { user, logout } = useAuth();
    const updateMutation = useUpdateUser();
    const { toast } = useToast();
    const [previewImage, setPreviewImage] = useState<string | null>(user?.profileImageUrl || null);

    const form = useForm<z.infer<typeof settingsSchema>>({
        resolver: zodResolver(settingsSchema),
        defaultValues: {
            username: user?.username || "",
            email: user?.email || "",
            firstName: user?.firstName || "",
            lastName: user?.lastName || "",
            password: "",
        },
    });

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const onSubmit = async (data: z.infer<typeof settingsSchema>) => {
        try {
            const payload: any = { ...data };
            if (!data.password) delete payload.password;
            if (previewImage && previewImage !== user?.profileImageUrl) {
                payload.profileImageUrl = previewImage;
            }

            await updateMutation.mutateAsync(payload);
            toast({
                title: "Profile Updated",
                description: "Your account settings have been saved successfully.",
            });
            form.reset({ ...data, password: "" });
        } catch (error: any) {
            toast({
                title: "Update Failed",
                description: error.message || "Failed to update profile info.",
                variant: "destructive",
            });
        }
    };

    return (
        <LayoutShell>
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Account Settings</h1>
                <p className="text-muted-foreground">Manage your officer profile and security preferences.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Profile Information</CardTitle>
                            <CardDescription>Update your personal details and contact information.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                    <div className="flex flex-col md:flex-row gap-8 items-start md:items-center mb-8">
                                        <div className="relative group">
                                            <Avatar className="w-24 h-24 border-2 border-primary/20 group-hover:border-primary transition-colors">
                                                <AvatarImage src={previewImage || undefined} />
                                                <AvatarFallback className="bg-muted text-2xl font-bold">
                                                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                            <label
                                                htmlFor="photo-upload"
                                                className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full cursor-pointer shadow-lg hover:bg-primary/90 transition-all scale-100 active:scale-90"
                                            >
                                                <Camera className="w-4 h-4" />
                                                <input
                                                    id="photo-upload"
                                                    type="file"
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={handleImageChange}
                                                />
                                            </label>
                                        </div>
                                        <div className="space-y-1">
                                            <h3 className="font-semibold text-lg">Profile Photo</h3>
                                            <p className="text-sm text-muted-foreground">Upload a professional photo for your officer credentials.</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="firstName"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>First Name</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="lastName"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Last Name</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="username"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Officer ID (Username)</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                        <Input {...field} className="pl-9" />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Official Email</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                        <Input {...field} type="email" className="pl-9" />
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <div className="pt-4 border-t border-border">
                                        <h3 className="font-semibold mb-4 flex items-center gap-2">
                                            <Lock className="w-4 h-4" /> Security update
                                        </h3>
                                        <FormField
                                            control={form.control}
                                            name="password"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>New Password (Optional)</FormLabel>
                                                    <FormControl>
                                                        <Input type="password" {...field} placeholder="Leave blank to keep current" />
                                                    </FormControl>
                                                    <CardDescription className="pt-1">Minimum 6 characters for enhanced security.</CardDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <Button type="submit" className="w-full md:w-auto min-w-[150px]" disabled={updateMutation.isPending}>
                                        {updateMutation.isPending ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Saving Changes...
                                            </>
                                        ) : (
                                            "Save Profile"
                                        )}
                                    </Button>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="bg-primary/5 border-primary/10">
                        <CardHeader>
                            <CardTitle className="text-lg">Session Management</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-3 bg-background rounded-lg border border-border flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium">Logged in as</p>
                                    <p className="text-xs text-muted-foreground">{user?.username}</p>
                                </div>
                                <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                            </div>
                            <Button
                                variant="outline"
                                className="w-full justify-start gap-2 text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => logout()}
                            >
                                <LogOut className="w-4 h-4" />
                                Terminate Session
                            </Button>


                        </CardContent>
                    </Card>

                    <div className="p-6 rounded-xl bg-slate-900 text-white relative overflow-hidden">
                        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
                        <div className="relative z-10 space-y-3">
                            <h3 className="font-bold">System Status</h3>
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400">Restricted Access</span>
                                    <span className="text-primary font-bold">ACTIVE</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-400">Encryption Level</span>
                                    <span className="text-primary font-bold">AES-256</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </LayoutShell>
    );
}

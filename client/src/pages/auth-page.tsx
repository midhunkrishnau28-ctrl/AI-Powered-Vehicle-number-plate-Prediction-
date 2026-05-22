import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Lock, User, Loader2, AlertCircle, Mail, ArrowLeft, KeyRound, CheckCircle2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const authSchema = z.object({
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(6, "Password must be at least 6 characters"),
});

const registerSchema = authSchema.extend({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Invalid email address"),
});

// ── Forgot-password sub-views ──────────────────────────────────────────────
type ForgotStep = "email" | "otp" | "newpass" | "done";

function ForgotPasswordFlow({ onBack }: { onBack: () => void }) {
    const { toast } = useToast();
    const [step, setStep] = useState<ForgotStep>("email");
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [timeLeft, setTimeLeft] = useState(600);

    useEffect(() => {
        if (step !== "otp") return;
        setTimeLeft(600);
        const t = setInterval(() => setTimeLeft(s => s <= 1 ? 0 : s - 1), 1000);
        return () => clearInterval(t);
    }, [step]);

    const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

    const emailForm = useForm({ defaultValues: { email: "" } });
    const onEmailSubmit = async ({ email: e }: { email: string }) => {
        setLoading(true);
        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: e.trim().toLowerCase() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setEmail(e.trim().toLowerCase());
            toast({ title: "OTP Sent", description: "Check your registered email for the 6-digit code." });
            setStep("otp");
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally { setLoading(false); }
    };

    const otpForm = useForm({ defaultValues: { otp: "" } });
    const onOtpSubmit = async ({ otp: o }: { otp: string }) => {
        setLoading(true);
        try {
            const res = await fetch("/api/auth/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otp: o.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setOtp(o.trim());
            setStep("newpass");
        } catch (err: any) {
            toast({ title: "Invalid OTP", description: err.message, variant: "destructive" });
        } finally { setLoading(false); }
    };

    const passForm = useForm({
        defaultValues: { newPassword: "", confirmPassword: "" },
        resolver: zodResolver(
            z.object({
                newPassword: z.string().min(6, "Minimum 6 characters"),
                confirmPassword: z.string(),
            }).refine(d => d.newPassword === d.confirmPassword, {
                message: "Passwords do not match",
                path: ["confirmPassword"],
            })
        ),
    });
    const onPassSubmit = async ({ newPassword }: { newPassword: string; confirmPassword: string }) => {
        setLoading(true);
        try {
            const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otp, newPassword }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setStep("done");
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally { setLoading(false); }
    };

    if (step === "done") return (
        <div className="text-center space-y-4 py-4">
            <div className="flex justify-center"><CheckCircle2 className="w-14 h-14 text-green-500" /></div>
            <h3 className="font-bold text-lg">Password Reset Successful!</h3>
            <p className="text-sm text-muted-foreground">Your password has been updated. You can now log in with your new password.</p>
            <Button className="w-full" onClick={onBack}>Back to Login</Button>
        </div>
    );

    const stepIndex = ["email", "otp", "newpass"].indexOf(step);

    return (
        <div className="space-y-4">
            <button onClick={onBack} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-3 h-3" /> Back to Login
            </button>

            {/* Progress bar */}
            <div className="flex items-center gap-2 pb-2">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-2 flex-1">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300
                            ${stepIndex === i ? "bg-primary text-primary-foreground scale-110" :
                            stepIndex > i ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}>
                            {stepIndex > i ? "✓" : i + 1}
                        </div>
                        {i < 2 && <div className={`h-0.5 flex-1 transition-colors duration-300 ${stepIndex > i ? "bg-green-500" : "bg-muted"}`} />}
                    </div>
                ))}
            </div>

            {/* Step 1: Email */}
            {step === "email" && (
                <div className="space-y-4">
                    <div>
                        <h3 className="font-semibold text-base">Forgot Password?</h3>
                        <p className="text-xs text-muted-foreground mt-1">Enter your registered officer email. A one-time password will be sent to it.</p>
                    </div>
                    <Form {...emailForm}>
                        <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-3">
                            <FormField control={emailForm.control} name="email"
                                rules={{ required: "Email is required" }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Official Email</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                <Input {...field} type="email" className="pl-9" placeholder="officer@keralapolice.gov.in" />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending OTP...</> : "Send OTP to Email"}
                            </Button>
                        </form>
                    </Form>
                </div>
            )}

            {/* Step 2: OTP */}
            {step === "otp" && (
                <div className="space-y-4">
                    <div>
                        <h3 className="font-semibold text-base">Enter OTP</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                            A 6-digit code was sent to <span className="font-medium text-foreground">{email}</span>.{" "}
                            {timeLeft > 0
                                ? <span className="text-primary font-medium">Expires in {fmt(timeLeft)}</span>
                                : <span className="text-red-500 font-medium">Expired — please request a new OTP.</span>}
                        </p>
                    </div>
                    <Form {...otpForm}>
                        <form onSubmit={otpForm.handleSubmit(onOtpSubmit)} className="space-y-3">
                            <FormField control={otpForm.control} name="otp"
                                rules={{ required: "OTP is required", minLength: { value: 6, message: "OTP must be 6 digits" } }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>6-Digit OTP</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                <Input
                                                    {...field}
                                                    className="pl-9 text-center text-2xl tracking-[0.5em] font-mono h-14"
                                                    maxLength={6}
                                                    placeholder="------"
                                                    onChange={e => field.onChange(e.target.value.replace(/\D/g, ""))}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            <Button type="submit" className="w-full" disabled={loading || timeLeft === 0}>
                                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : "Verify OTP"}
                            </Button>
                            <Button type="button" variant="ghost" size="sm" className="w-full text-xs"
                                onClick={() => { setStep("email"); }}>
                                Didn't receive it? Resend OTP
                            </Button>
                        </form>
                    </Form>
                </div>
            )}

            {/* Step 3: New Password */}
            {step === "newpass" && (
                <div className="space-y-4">
                    <div>
                        <h3 className="font-semibold text-base">Set New Password</h3>
                        <p className="text-xs text-muted-foreground mt-1">Choose a strong password for your officer account.</p>
                    </div>
                    <Form {...passForm}>
                        <form onSubmit={passForm.handleSubmit(onPassSubmit)} className="space-y-3">
                            <FormField control={passForm.control} name="newPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>New Password</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                <Input type="password" {...field} className="pl-9" placeholder="Minimum 6 characters" />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            <FormField control={passForm.control} name="confirmPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Confirm Password</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                <Input type="password" {...field} className="pl-9" placeholder="Repeat password" />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resetting Password...</> : "Reset Password"}
                            </Button>
                        </form>
                    </Form>
                </div>
            )}
        </div>
    );
}

// ── Main Auth Page ─────────────────────────────────────────────────────────
export default function AuthPage() {
    const { login, register, isAuthenticated } = useAuth();
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<"login" | "register">("login");
    const [showForgot, setShowForgot] = useState(false);

    if (isAuthenticated) {
        setLocation("/");
    }

    const loginForm = useForm<z.infer<typeof authSchema>>({
        resolver: zodResolver(authSchema),
        defaultValues: { username: "", password: "" },
    });

    const registerForm = useForm<z.infer<typeof registerSchema>>({
        resolver: zodResolver(registerSchema),
        defaultValues: { username: "", password: "", firstName: "", lastName: "", email: "" },
    });

    const onLoginSubmit = async (data: z.infer<typeof authSchema>) => {
        try {
            await login(data);
        } catch {
            toast({ title: "Login Failed", description: "Invalid username or password.", variant: "destructive" });
        }
    };

    const onRegisterSubmit = async (data: z.infer<typeof registerSchema>) => {
        try {
            await register(data);
            toast({ title: "Account Created", description: "Welcome to the Intelligence Wing portal." });
        } catch (error: any) {
            toast({ title: "Registration Failed", description: error.message || "Username or email may already be taken.", variant: "destructive" });
        }
    };

    return (
        <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
            {/* Left: Branding */}
            <div className="hidden lg:flex flex-col items-center justify-center bg-slate-950 text-white p-12 relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20" />
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
                <div className="relative z-10 max-w-md w-full text-center space-y-8">
                    <div className="inline-flex p-4 rounded-2xl bg-primary shadow-2xl shadow-primary/40">
                        <ShieldCheck className="w-16 h-16 text-white" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-4xl font-bold tracking-tight">KERALA POLICE</h1>
                        <p className="text-primary font-mono tracking-widest uppercase">Intelligence Wing</p>
                    </div>
                    <p className="text-slate-400 text-lg leading-relaxed">
                        Advanced forensic image analysis and vehicle tracking system. Restricted access for authorized personnel only.
                    </p>
                    <div className="grid grid-cols-2 gap-4 pt-12 text-left">
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                            <Lock className="w-5 h-5 text-primary mb-2" />
                            <h3 className="font-semibold text-sm">Private Reports</h3>
                            <p className="text-xs text-slate-500">Each officer sees only their own analyses.</p>
                        </div>
                        <div className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                            <AlertCircle className="w-5 h-5 text-primary mb-2" />
                            <h3 className="font-semibold text-sm">OTP Recovery</h3>
                            <p className="text-xs text-slate-500">Secure email-based password reset.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right: Forms */}
            <div className="flex items-center justify-center p-6 bg-background">
                <Card className="w-full max-w-md shadow-2xl border-primary/10">
                    <CardHeader className="space-y-1 text-center">
                        <div className="lg:hidden flex justify-center mb-4">
                            <ShieldCheck className="w-12 h-12 text-primary" />
                        </div>
                        <CardTitle className="text-2xl font-bold tracking-tight">Officer Portal</CardTitle>
                        <CardDescription>
                            {showForgot ? "Secure password recovery via email OTP" : "Enter your credentials to access the system"}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {showForgot ? (
                            <ForgotPasswordFlow onBack={() => setShowForgot(false)} />
                        ) : (
                            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
                                <TabsList className="grid w-full grid-cols-2">
                                    <TabsTrigger value="login">Login</TabsTrigger>
                                    <TabsTrigger value="register">Register</TabsTrigger>
                                </TabsList>

                                <TabsContent value="login" className="space-y-4 pt-4">
                                    <Form {...loginForm}>
                                        <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                                            <FormField control={loginForm.control} name="username"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Username</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                                <Input {...field} className="pl-9" placeholder="Enter officer ID" />
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                            <FormField control={loginForm.control} name="password"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Password</FormLabel>
                                                        <FormControl>
                                                            <div className="relative">
                                                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                                <Input type="password" {...field} className="pl-9" placeholder="••••••••" />
                                                            </div>
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                            <Button type="submit" className="w-full shadow-lg shadow-primary/20"
                                                disabled={loginForm.formState.isSubmitting}>
                                                {loginForm.formState.isSubmitting
                                                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</>
                                                    : "Log In"}
                                            </Button>
                                        </form>
                                    </Form>
                                    <div className="text-center pt-1">
                                        <button type="button" onClick={() => setShowForgot(true)}
                                            className="text-xs text-muted-foreground hover:text-primary transition-colors hover:underline underline-offset-4">
                                            Forgot your password?
                                        </button>
                                    </div>
                                </TabsContent>

                                <TabsContent value="register" className="space-y-4 pt-4">
                                    <Form {...registerForm}>
                                        <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <FormField control={registerForm.control} name="firstName"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>First Name</FormLabel>
                                                            <FormControl><Input {...field} placeholder="John" /></FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )} />
                                                <FormField control={registerForm.control} name="lastName"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Last Name</FormLabel>
                                                            <FormControl><Input {...field} placeholder="Doe" /></FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )} />
                                            </div>
                                            <FormField control={registerForm.control} name="email"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Official Email</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} type="email" placeholder="officer@keralapolice.gov.in" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                            <FormField control={registerForm.control} name="username"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Desired Username</FormLabel>
                                                        <FormControl><Input {...field} placeholder="KP-XXXXX" /></FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                            <FormField control={registerForm.control} name="password"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Password</FormLabel>
                                                        <FormControl>
                                                            <Input type="password" {...field} placeholder="••••••••" />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )} />
                                            <Button type="submit" className="w-full shadow-lg shadow-primary/20"
                                                disabled={registerForm.formState.isSubmitting}>
                                                {registerForm.formState.isSubmitting
                                                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                                                    : "Create Officer Account"}
                                            </Button>
                                        </form>
                                    </Form>
                                </TabsContent>
                            </Tabs>
                        )}
                    </CardContent>
                    <CardFooter className="justify-center">
                        <p className="text-xs text-muted-foreground text-center">
                            Unauthorized access to this system is a punishable offense under the IT Act 2000.
                        </p>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
}

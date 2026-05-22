import { Button } from "@/components/ui/button";
import { ShieldCheck, Lock, Activity, Eye, ChevronRight } from "lucide-react";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary" />
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-tight">KERALA POLICE</h1>
              <p className="text-[10px] text-muted-foreground font-mono tracking-widest uppercase">Cyber Intelligence Wing</p>
            </div>
          </div>
          <Button onClick={handleLogin} className="shadow-lg shadow-primary/20">
            Official Login
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 relative overflow-hidden flex flex-col items-center justify-center py-20 lg:py-32 px-6 text-center">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
        </div>
        
        <div className="relative z-10 max-w-4xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
            <Activity className="w-4 h-4" />
            <span>Advanced AI Surveillance System v2.0</span>
          </div>
          
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground">
            Clearer Evidence.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">
              Faster Justice.
            </span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Next-generation number plate recognition and image enhancement powered by artificial intelligence. Secure, accurate, and instant.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" className="text-lg px-8 h-14 shadow-xl shadow-primary/25" onClick={handleLogin}>
              Access Dashboard <ChevronRight className="ml-2 w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 h-14 bg-background/50 backdrop-blur">
              System Status
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-muted/30 py-24 border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-card p-8 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
                <Eye className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">AI Enhancement</h3>
              <p className="text-muted-foreground leading-relaxed">
                Recover details from blurry, low-light, or high-speed footage using state-of-the-art restorative generative models.
              </p>
            </div>
            
            <div className="bg-card p-8 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Instant OCR</h3>
              <p className="text-muted-foreground leading-relaxed">
                Real-time optical character recognition optimized for Indian vehicle registration plates (HSRP support included).
              </p>
            </div>

            <div className="bg-card p-8 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-6">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-3">Secure Audit Trail</h3>
              <p className="text-muted-foreground leading-relaxed">
                Every analysis is logged, timestamped, and cryptographically signed to ensure chain of custody for legal proceedings.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 opacity-80">
            <ShieldCheck className="w-6 h-6" />
            <span className="font-bold">KERALA POLICE</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Cyber Intelligence Wing. Authorized personnel only.
          </p>
        </div>
      </footer>
    </div>
  );
}

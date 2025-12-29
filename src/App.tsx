import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import ProfilePage from "./pages/ProfilePage";
import NewGamePage from "./pages/NewGamePage";
import JoinGamePage from "./pages/JoinGamePage";
import JoinWithCodePage from "./pages/JoinWithCodePage";
import LobbyPage from "./pages/LobbyPage";
import GamePage from "./pages/GamePage";
import PlayPage from "./pages/PlayPage";
import AdminPage from "./pages/AdminPage";
import AdminWordsPage from "./pages/AdminWordsPage";
import AdminPacksPage from "./pages/AdminPacksPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/new-game" element={<NewGamePage />} />
            <Route path="/join" element={<JoinGamePage />} />
            <Route path="/join/:code" element={<JoinWithCodePage />} />
            <Route path="/lobby/:sessionId" element={<LobbyPage />} />
            <Route path="/game/:sessionId" element={<GamePage />} />
            <Route path="/play/:sessionId/:playerId" element={<PlayPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/admin/words" element={<AdminWordsPage />} />
            <Route path="/admin/packs" element={<AdminPacksPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

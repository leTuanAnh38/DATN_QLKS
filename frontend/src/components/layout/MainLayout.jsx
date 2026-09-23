import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

export default function MainLayout({ children, actionText, actionLink, onActionClick }) {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-800 font-sans antialiased selection:bg-blue-600 selection:text-white flex flex-col justify-between">
            <Navbar
                actionText={actionText}
                actionLink={actionLink}
                onActionClick={onActionClick}
            />
            <main className="flex-1">
                {children || <Outlet />}
            </main>
            <Footer />
        </div>
    );
}

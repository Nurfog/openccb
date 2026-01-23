'use client';

import { useState, useEffect } from 'react';
import { cmsApi, User, Organization } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { UserCog, Mail, Search, Filter, ShieldCheck, Plus, X, UserPlus, Key, User as UserIcon } from 'lucide-react';

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const { user: currentUser } = useAuth();

    // Create User States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newUser, setNewUser] = useState({
        email: '',
        password: '',
        full_name: '',
        role: 'student'
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [usersData, orgsData] = await Promise.all([
                cmsApi.getAllUsers(),
                cmsApi.getOrganizations()
            ]);
            setUsers(usersData);
            setOrganizations(orgsData);
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateUser = async (userId: string, role: string, orgId: string) => {
        try {
            await cmsApi.updateUser(userId, { role, organization_id: orgId });
            loadData();
        } catch (error) {
            console.error('Failed to update user', error);
        }
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await cmsApi.createUser(newUser);
            setNewUser({ email: '', password: '', full_name: '', role: 'student' });
            setIsModalOpen(false);
            loadData();
        } catch (error) {
            console.error('Failed to create user', error);
            alert('Failed to create user. Ensure email is unique.');
        }
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === '' || u.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    if (currentUser?.role !== 'admin') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="p-4 rounded-full bg-red-500/10 mb-4">
                    <ShieldCheck className="w-12 h-12 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
                <p className="text-gray-400">Only system administrators can access this page.</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
                    <p className="text-gray-400 mt-1">Manage users, roles, and organization assignments.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-lg shadow-blue-500/20"
                >
                    <Plus className="w-4 h-4" />
                    Add User
                </button>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                </div>
                <div className="flex gap-4">
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="bg-black/40 border border-white/10 rounded-lg pl-10 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer"
                        >
                            <option value="">All Roles</option>
                            <option value="admin">Admin</option>
                            <option value="instructor">Instructor</option>
                            <option value="student">Student</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="glass border border-white/10 rounded-xl overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-white/5 border-b border-white/10">
                        <tr>
                            <th className="px-6 py-4 text-sm font-semibold">User</th>
                            <th className="px-6 py-4 text-sm font-semibold">Role</th>
                            <th className="px-6 py-4 text-sm font-semibold">Organization</th>
                            <th className="px-6 py-4 text-sm font-semibold text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {loading ? (
                            [1, 2, 3, 4, 5].map(i => (
                                <tr key={i} className="animate-pulse">
                                    <td className="px-6 py-4"><div className="h-4 w-32 bg-white/10 rounded" /></td>
                                    <td className="px-6 py-4"><div className="h-4 w-16 bg-white/10 rounded" /></td>
                                    <td className="px-6 py-4"><div className="h-4 w-24 bg-white/10 rounded" /></td>
                                    <td className="px-6 py-4 text-right"><div className="h-4 w-8 bg-white/10 ml-auto rounded" /></td>
                                </tr>
                            ))
                        ) : filteredUsers.map((u) => (
                            <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                                            {u.full_name[0]}
                                        </div>
                                        <div>
                                            <div className="font-medium">{u.full_name}</div>
                                            <div className="text-xs text-gray-500 flex items-center gap-1">
                                                <Mail className="w-3 h-3" /> {u.email}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <select
                                        value={u.role}
                                        onChange={(e) => handleUpdateUser(u.id, e.target.value, u.organization_id || '00000000-0000-0000-0000-000000000000')}
                                        className="bg-black/20 border border-white/5 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500/50"
                                    >
                                        <option value="admin">Admin</option>
                                        <option value="instructor">Instructor</option>
                                        <option value="student">Student</option>
                                    </select>
                                </td>
                                <td className="px-6 py-4">
                                    <select
                                        value={u.organization_id || '00000000-0000-0000-0000-000000000000'}
                                        onChange={(e) => handleUpdateUser(u.id, u.role, e.target.value)}
                                        className="bg-black/20 border border-white/5 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500/50 max-w-[150px]"
                                    >
                                        {organizations.map(org => (
                                            <option key={org.id} value={org.id}>{org.name}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="p-2 hover:bg-white/10 rounded-lg transition-all text-gray-400 hover:text-white opacity-0 group-hover:opacity-100">
                                        <UserCog className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {!loading && filteredUsers.length === 0 && (
                    <div className="p-12 text-center text-gray-500">
                        No users found matching your search.
                    </div>
                )}
            </div>

            {/* Create User Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md glass border border-white/10 rounded-2xl p-8 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                    <UserPlus className="w-5 h-5" />
                                </div>
                                <h2 className="text-xl font-bold">Add New User</h2>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-500">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Full Name</label>
                                <div className="relative">
                                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input
                                        type="text"
                                        required
                                        value={newUser.full_name}
                                        onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                        placeholder="e.g. John Doe"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input
                                        type="email"
                                        required
                                        value={newUser.email}
                                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono text-sm"
                                        placeholder="user@example.com"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">Initial Password</label>
                                <div className="relative">
                                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input
                                        type="password"
                                        required
                                        value={newUser.password}
                                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1.5">User Role</label>
                                <select
                                    value={newUser.role}
                                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="student">Student</option>
                                    <option value="instructor">Instructor</option>
                                    <option value="admin">Administrator (Organization Admin)</option>
                                </select>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-[2] px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-all shadow-lg shadow-blue-500/20 font-bold"
                                >
                                    Create User
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

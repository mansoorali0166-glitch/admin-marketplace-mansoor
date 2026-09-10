import React, { useState } from 'react';
import './AdminLayout.css';
import Dashboard from './Dashboard';
import Merchants from './Merchants';
import AllAgents from './AllAgents';
import ActiveAgents from './ActiveAgents';
import SuspendedAgents from './SuspendedAgents';
import DeletedAgents from './DeletedAgents';
import AgentInvitationCodes from './AgentInvitationCodes';
import AllOrders from './AllOrders';
import Disputes from './Disputes';
import StoreShowcase from './StoreShowcase';
import GeneralConfig from './GeneralConfig';
import Withdrawals from './Withdrawals';
import CreditLogs from './CreditLogs';
import Announcements from './Announcements';
import ChatCenter from './ChatCenter';
import Feedbacks from './Feedbacks';
import AuditLogs from './AuditLogs';
import MyAccount from './MyAccount';

export default function AdminLayout({ onLogout }) {
  const [activeTab, setActiveTab] = useState('Dashboard');

  const [openMenus, setOpenMenus] = useState({
    agents: true,
    orders: true,
    finance: true,
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMenu = (menu) => {
    setOpenMenus((prev) => ({
      ...prev,
      [menu]: !prev[menu],
    }));
  };

  const handleTabClick = (tab) => {
    setActiveTab(tab);

    // Close mobile sidebar after selecting a tab
    setMobileMenuOpen(false);
  };

  /*
    These functions make the MAIN parent tab blue
    whenever one of its subtabs is selected.
  */

  const agentsActive = [
    'All Agents',
    'Active Agents',
    'Suspended Agents',
    'Deleted Agents',
    'Agent Invitation Codes',
  ].includes(activeTab);

  const ordersActive = [
    'All Orders',
    'Disputes',
  ].includes(activeTab);

  const financeActive = [
    'Withdrawals',
    'Credit Logs',
  ].includes(activeTab);

  return (
    <div className="admin-layout">

      {/* =====================================================
          MOBILE OVERLAY
          ===================================================== */}
      {mobileMenuOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* =====================================================
          SIDEBAR
          ===================================================== */}
      <aside
        className={`admin-sidebar ${
          mobileMenuOpen ? 'mobile-sidebar-open' : ''
        }`}
      >

        {/* Brand */}
        <div className="admin-brand">
          <h2>MarketHub Admin</h2>

          {/* Mobile close button */}
          <button
            className="mobile-close-btn"
            onClick={() => setMobileMenuOpen(false)}
          >
            ×
          </button>
        </div>


        {/* =====================================================
            NAVIGATION
            ===================================================== */}
        <nav className="admin-navigation">

          {/* ================= DASHBOARD ================= */}

          <div
            className={`nav-item ${
              activeTab === 'Dashboard' ? 'active' : ''
            }`}
            onClick={() => handleTabClick('Dashboard')}
          >
            <span className="nav-icon">⊞</span>
            <span>Dashboard</span>
          </div>


          {/* ================= MERCHANTS ================= */}

          <div
            className={`nav-item ${
              activeTab === 'Merchants' ? 'active' : ''
            }`}
            onClick={() => handleTabClick('Merchants')}
          >
            <span className="nav-icon">♙</span>
            <span>Merchants</span>
          </div>


          {/* =================================================
              AGENTS
              ================================================= */}

          <div className="nav-group">

            <div
              className={`nav-item nav-parent ${
                agentsActive ? 'parent-active' : ''
              }`}
              onClick={() => toggleMenu('agents')}
            >

              <div className="nav-parent-left">
                <span className="nav-icon">♙</span>
                <span>Agents</span>
              </div>

              <span className="nav-arrow">
                {openMenus.agents ? '⌄' : '›'}
              </span>

            </div>


            {openMenus.agents && (
              <div className="submenu">

                <div
                  className={`submenu-item ${
                    activeTab === 'All Agents'
                      ? 'active-sub'
                      : ''
                  }`}
                  onClick={() => handleTabClick('All Agents')}
                >
                  All Agents
                </div>


                <div
                  className={`submenu-item ${
                    activeTab === 'Active Agents'
                      ? 'active-sub'
                      : ''
                  }`}
                  onClick={() => handleTabClick('Active Agents')}
                >
                  Active Agents
                </div>


                <div
                  className={`submenu-item ${
                    activeTab === 'Suspended Agents'
                      ? 'active-sub'
                      : ''
                  }`}
                  onClick={() =>
                    handleTabClick('Suspended Agents')
                  }
                >
                  Suspended Agents
                </div>


                <div
                  className={`submenu-item ${
                    activeTab === 'Agent Invitation Codes'
                      ? 'active-sub'
                      : ''
                  }`}
                  onClick={() =>
                    handleTabClick('Agent Invitation Codes')
                  }
                >
                  Agent Invitation Codes
                </div>

                <div
                  className={`submenu-item ${activeTab === 'Deleted Agents' ? 'active-sub' : ''}`}
                  onClick={() => handleTabClick('Deleted Agents')}
                >
                  Deleted Agents
                </div>

              </div>
            )}

          </div>


          {/* =================================================
              ORDERS
              ================================================= */}

          <div className="nav-group">

            <div
              className={`nav-item nav-parent ${
                ordersActive ? 'parent-active' : ''
              }`}
              onClick={() => toggleMenu('orders')}
            >

              <div className="nav-parent-left">
                <span className="nav-icon">▤</span>
                <span>Orders</span>
              </div>

              <span className="nav-arrow">
                {openMenus.orders ? '⌄' : '›'}
              </span>

            </div>


            {openMenus.orders && (
              <div className="submenu">

                <div
                  className={`submenu-item ${
                    activeTab === 'All Orders'
                      ? 'active-sub'
                      : ''
                  }`}
                  onClick={() => handleTabClick('All Orders')}
                >
                  All Orders
                </div>


                <div
                  className={`submenu-item ${
                    activeTab === 'Disputes'
                      ? 'active-sub'
                      : ''
                  }`}
                  onClick={() => handleTabClick('Disputes')}
                >
                  Disputes
                </div>

              </div>
            )}

          </div>


          {/* ================= STORE SHOWCASE ================= */}

          <div
            className={`nav-item ${
              activeTab === 'Store Showcase'
                ? 'active'
                : ''
            }`}
            onClick={() => handleTabClick('Store Showcase')}
          >
            <span className="nav-icon">⌂</span>
            <span>Store Showcase</span>
          </div>


          {/* ================= GENERAL CONFIG ================= */}

          <div
            className={`nav-item ${
              activeTab === 'General Config'
                ? 'active'
                : ''
            }`}
            onClick={() => handleTabClick('General Config')}
          >
            <span className="nav-icon">⚙</span>
            <span>General Config</span>
          </div>


          {/* =================================================
              FINANCE
              ================================================= */}

          <div className="nav-group">

            <div
              className={`nav-item nav-parent ${
                financeActive ? 'parent-active' : ''
              }`}
              onClick={() => toggleMenu('finance')}
            >

              <div className="nav-parent-left">
                <span className="nav-icon">$</span>
                <span>Finance</span>
              </div>

              <span className="nav-arrow">
                {openMenus.finance ? '⌄' : '›'}
              </span>

            </div>


            {openMenus.finance && (
              <div className="submenu">

                <div
                  className={`submenu-item ${
                    activeTab === 'Withdrawals'
                      ? 'active-sub'
                      : ''
                  }`}
                  onClick={() =>
                    handleTabClick('Withdrawals')
                  }
                >
                  Withdrawals
                </div>


                <div
                  className={`submenu-item ${
                    activeTab === 'Credit Logs'
                      ? 'active-sub'
                      : ''
                  }`}
                  onClick={() =>
                    handleTabClick('Credit Logs')
                  }
                >
                  Credit Logs
                </div>

              </div>
            )}

          </div>


          {/* ================= ANNOUNCEMENTS ================= */}

          <div
            className={`nav-item ${
              activeTab === 'Announcements'
                ? 'active'
                : ''
            }`}
            onClick={() =>
              handleTabClick('Announcements')
            }
          >
            <span className="nav-icon">▣</span>
            <span>Announcements</span>
          </div>


          {/* ================= CHAT ================= */}

          <div
            className={`nav-item ${
              activeTab === 'Chat'
                ? 'active'
                : ''
            }`}
            onClick={() => handleTabClick('Chat')}
          >
            <span className="nav-icon">▣</span>
            <span>Chat</span>
          </div>


          {/* ================= FEEDBACKS ================= */}

          <div
            className={`nav-item ${
              activeTab === 'Feedbacks'
                ? 'active'
                : ''
            }`}
            onClick={() =>
              handleTabClick('Feedbacks')
            }
          >
            <span className="nav-icon">◯</span>
            <span>Feedbacks</span>
          </div>


          {/* ================= AUDIT LOGS ================= */}

          <div
            className={`nav-item ${
              activeTab === 'Audit Logs'
                ? 'active'
                : ''
            }`}
            onClick={() =>
              handleTabClick('Audit Logs')
            }
          >
            <span className="nav-icon">♢</span>
            <span>Audit Logs</span>
          </div>


          {/* ================= MY ACCOUNT ================= */}

          <div
            className={`nav-item ${
              activeTab === 'My Account'
                ? 'active'
                : ''
            }`}
            onClick={() =>
              handleTabClick('My Account')
            }
          >
            <span className="nav-icon">♧</span>
            <span>My Account</span>
          </div>

        </nav>


        {/* =====================================================
            SIGN OUT
            ===================================================== */}

        <div className="admin-sidebar-footer">

          <div
            className="nav-item logout-item"
            onClick={onLogout}
          >
            <span className="nav-icon">⇥</span>
            <span>Sign Out</span>
          </div>

        </div>

      </aside>


      {/* =====================================================
          MAIN AREA
          ===================================================== */}

      <main className="admin-main">

        {/* Header */}

        <div className="main-header">

          {/* Mobile menu button */}

          <button
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(true)}
          >
            ☰
          </button>

          <h1>{activeTab}</h1>

        </div>


        {/* Main content */}

        <div className="main-content">
          {activeTab === 'Dashboard' && (
            <Dashboard
              onOpenMerchants={() => handleTabClick('Merchants')}
            />
          )}

          {activeTab === 'Merchants' && <Merchants />}

          {activeTab === 'All Agents' && <AllAgents />}

          {activeTab === 'Active Agents' && <ActiveAgents />}

          {activeTab === 'Suspended Agents' && <SuspendedAgents />}

          {activeTab === 'Deleted Agents' && <DeletedAgents />}

          {activeTab === 'Agent Invitation Codes' && (
            <AgentInvitationCodes />
          )}

          {activeTab === 'All Orders' && <AllOrders />}

          {activeTab === 'Disputes' && <Disputes />}

          {activeTab === 'Store Showcase' && <StoreShowcase />}

          {activeTab === 'General Config' && <GeneralConfig />}

          {activeTab === 'Withdrawals' && <Withdrawals />}

          {activeTab === 'Credit Logs' && <CreditLogs />}

          {activeTab === 'Announcements' && <Announcements />}

          {activeTab === 'Chat' && <ChatCenter />}

          {activeTab === 'Feedbacks' && <Feedbacks />}

          {activeTab === 'Audit Logs' && <AuditLogs />}

          {activeTab === 'My Account' && <MyAccount />}
        </div>
      </main>

    </div>
  );
}

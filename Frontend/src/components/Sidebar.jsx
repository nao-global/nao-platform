import "./Sidebar.css";
import logo from "../assets/images/NAO.png";

import { useState } from "react";
import { NavLink } from "react-router-dom";

import {
    FaHome,
    FaBoxes,
    FaExclamationTriangle,
    FaChartBar,
    FaBell,
    FaCog,
    FaBars,
    FaTimes
} from "react-icons/fa";

function Sidebar() {

    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <>

            {/* Dark Overlay */}
            {menuOpen && (
                <div
                    className="overlay"
                    onClick={() => setMenuOpen(false)}
                ></div>
            )}

            {/* Hamburger Button */}
            {!menuOpen && (
                <button
                    className="menu-toggle"
                    onClick={() => setMenuOpen(true)}
                >
                    <FaBars />
                </button>
            )}

            {/* Sidebar */}
            <aside className={`sidebar ${menuOpen ? "open" : ""}`}>

                {/* Close Button */}
                <button
                    className="close-menu"
                    onClick={() => setMenuOpen(false)}
                >
                    <FaTimes />
                </button>

                {/* Logo */}
                <div className="logo">
                    <img
                        src={logo}
                        alt="NAO Logo"
                        className="logo"
                    />
                </div>

                {/* Navigation */}
                <nav className="sidebar-menu">

                    <NavLink
                        to="/"
                        onClick={() => setMenuOpen(false)}
                    >
                        <FaHome />
                        Dashboard
                    </NavLink>

                    <NavLink
                        to="/materials"
                        onClick={() => setMenuOpen(false)}
                    >
                        <FaBoxes />
                        Materials
                    </NavLink>

                    <NavLink
                        to="/risks"
                        onClick={() => setMenuOpen(false)}
                    >
                        <FaExclamationTriangle />
                        Risks
                    </NavLink>

                    <NavLink
                        to="/reports"
                        className="sidebar-item"
                        onClick={() => setMenuOpen(false)}
                    >
                        <FaChartBar />
                        <span>Reports</span>
                    </NavLink>

                    <div className="disabled-link">
                        <FaBell />
                        Alerts
                    </div>

                    <div className="disabled-link">
                        <FaCog />
                        Settings
                    </div>

                </nav>

            </aside>

        </>
    );

}

export default Sidebar;
import React, { useRef } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import './ProfileCard.css';

interface ProfileCardProps {
  avatarUrl?: string;
  iconUrl?: string;
  grainUrl?: string;
  innerGradient?: string;
  behindGlowEnabled?: boolean;
  behindGlowColor?: string;
  behindGlowSize?: string;
  className?: string;
  enableTilt?: boolean;
  enableMobileTilt?: boolean;
  mobileTiltSensitivity?: number;
  miniAvatarUrl?: string;
  name?: string;
  title?: string;
  handle?: string;
  status?: string;
  contactText?: string;
  showUserInfo?: boolean;
  showNameHeader?: boolean;
  onContactClick?: () => void;
}

export function ProfileCard(props: ProfileCardProps) {
  const {
    avatarUrl = '<Placeholder for avatar URL>',
    iconUrl,
    grainUrl,
    innerGradient = 'linear-gradient(145deg,#60496e8c 0%,#71C4FF44 100%)',
    behindGlowEnabled = true,
    behindGlowColor = 'rgba(125, 190, 255, 0.67)',
    behindGlowSize = '50%',
    className = '',
    enableTilt = true,
    miniAvatarUrl,
    name = 'Javi A. Torres',
    title = 'Software Engineer',
    handle = 'javicodes',
    status = 'Online',
    contactText = 'Contact',
    showUserInfo = true,
    showNameHeader = false,
    onContactClick
  } = props;

  const cardRef = useRef<HTMLDivElement>(null);
  
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.5);

  const rotateX = useSpring(useTransform(mouseY, [0, 1], [8, -8]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [0, 1], [-8, 8]), { stiffness: 300, damping: 30 });

  const pointerX = useTransform(mouseX, v => `${v * 100}%`);
  const pointerY = useTransform(mouseY, v => `${v * 100}%`);
  const backgroundX = useTransform(mouseX, v => `${35 + v * 30}%`);
  const backgroundY = useTransform(mouseY, v => `${35 + v * 30}%`);
  const pointerFromCenter = useTransform(() => Math.hypot(mouseY.get() - 0.5, mouseX.get() - 0.5) * 2);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!enableTilt) return;
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width);
    mouseY.set((e.clientY - rect.top) / rect.height);
  }

  function handleMouseLeave() {
    if (!enableTilt) return;
    mouseX.set(0.5);
    mouseY.set(0.5);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const styleObj: any = {
    rotateX: enableTilt ? rotateX : 0,
    rotateY: enableTilt ? rotateY : 0,
    transformStyle: 'preserve-3d',
    perspective: 800,
    '--pointer-x': pointerX,
    '--pointer-y': pointerY,
    '--background-x': backgroundX,
    '--background-y': backgroundY,
    '--pointer-from-center': pointerFromCenter,
    '--icon': iconUrl ? `url(${iconUrl})` : 'none',
    '--grain': grainUrl ? `url(${grainUrl})` : 'none',
    '--inner-gradient': innerGradient,
    '--behind-glow-color': behindGlowColor,
    '--behind-glow-size': behindGlowSize,
  };

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`pc-card-wrapper ${className}`.trim()}
      style={styleObj}
    >
      {behindGlowEnabled && <div className="pc-behind" />}
      <div className="pc-card-shell">
        <section className="pc-card">
          <div className="pc-inside">
            <div className="pc-shine" />
            <div className="pc-glare" />
            <div className="pc-content pc-avatar-content">
              <img
                className="avatar"
                src={avatarUrl}
                alt={`${name} avatar`}
                loading="lazy"
                onError={e => { e.currentTarget.style.display = 'none'; }}
              />
              {showUserInfo && (
                <div className="pc-user-info">
                  <div className="pc-user-details">
                    <div className="pc-mini-avatar">
                      <img
                        src={miniAvatarUrl || avatarUrl}
                        alt={`${name} mini avatar`}
                        loading="lazy"
                        onError={e => {
                          e.currentTarget.style.opacity = '0.5';
                          e.currentTarget.src = avatarUrl;
                        }}
                      />
                    </div>
                    <div className="pc-user-text">
                      <div className="pc-handle">@{handle}</div>
                      <div className="pc-status">{status}</div>
                    </div>
                  </div>
                  <button
                    className="pc-contact-btn"
                    onClick={onContactClick}
                    style={{ pointerEvents: 'auto' }}
                    type="button"
                  >
                    {contactText}
                  </button>
                </div>
              )}
            </div>
            <div className="pc-content">
              {showNameHeader && (
                <div className="pc-details">
                  <h3>{name}</h3>
                  <p>{title}</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </motion.div>
  );
}

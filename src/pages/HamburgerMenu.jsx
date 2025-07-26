import React, { useState } from 'react';
import { Drawer, Button, Input } from 'antd';
import { MenuOutlined, ClockCircleOutlined, EnvironmentOutlined, SettingOutlined, ShareAltOutlined, HomeOutlined } from '@ant-design/icons';

const HamburgerMenu = ({ title, time, userAddress, shareableLink, copyShareableLink, copied }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const toggleDrawer = () => {
    setIsOpen(!isOpen);
  };

  const toggleShare = () => {
    setShowShare(!showShare);
  };

  const onClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      <Button
        type="primary"
        icon={<MenuOutlined />}
        onClick={toggleDrawer}
        style={{ position: 'fixed', top: 20, left: 20, zIndex: 1001 }}
      />
      <Drawer
        title={title}
        placement="left"
        onClose={onClose}
        visible={isOpen}
        bodyStyle={{ padding: 0 }}
      >
        <div style={{ padding: '20px' }}>
          <div style={{ marginBottom: '20px' }}>
            <ClockCircleOutlined style={{ marginRight: '10px' }} />
            <span>{new Date(time).toLocaleString()}</span>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <EnvironmentOutlined style={{ marginRight: '10px' }} />
            <span>{userAddress}</span>
          </div>
          <hr style={{ border: 0, borderTop: '1px solid #f0f0f0', margin: '20px 0' }} />
          <div>
            <Button type="text" icon={<ShareAltOutlined />} style={{ width: '100%', textAlign: 'left' }} onClick={toggleShare}>
              Share Rendezvous
            </Button>
            {showShare && (
              <div style={{ marginTop: '10px', display: 'flex' }}>
                <Input value={shareableLink} readOnly />
                <Button onClick={copyShareableLink} type={copied ? 'primary' : 'default'}>
                  {copied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            )}
          </div>
          <div>
            <Button type="text" icon={<SettingOutlined />} style={{ width: '100%', textAlign: 'left' }} onClick={onClose}>
              Settings
            </Button>
          </div>
          <div>
            <Button type="text" icon={<HomeOutlined />} style={{ width: '100%', textAlign: 'left' }} onClick={onClose}>
              Home
            </Button>
          </div>
        </div>
      </Drawer>
    </>
  );
};

export default HamburgerMenu;
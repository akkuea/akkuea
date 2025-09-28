package models

import "gorm.io/gorm"

// MarketplaceRequest represents a request in the marketplace
type MarketplaceRequest struct {
	gorm.Model
	RequesterID   uint    `json:"requester_id" gorm:"not null;index"`
	DesignerID    *uint   `json:"designer_id,omitempty" gorm:"index"` // Optional until assigned
	Status        string  `json:"status" gorm:"not null;size:20;default:'open'"` // open, assigned, completed, cancelled
	PaymentAmount float64 `json:"payment_amount" gorm:"type:decimal(10,2)"`
	
	// Foreign key relationships
	Requester User  `json:"requester" gorm:"foreignKey:RequesterID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
	Designer  *User `json:"designer,omitempty" gorm:"foreignKey:DesignerID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL"`
}

// TableName specifies the table name for MarketplaceRequest model
func (MarketplaceRequest) TableName() string {
	return "marketplace_requests"
}
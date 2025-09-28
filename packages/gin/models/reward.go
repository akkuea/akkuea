package models

import "gorm.io/gorm"

// Reward represents tokens or rewards given to users
type Reward struct {
	gorm.Model
	UserID      uint   `json:"user_id" gorm:"not null;index"`
	TokenAmount int    `json:"token_amount" gorm:"not null"`
	Reason      string `json:"reason" gorm:"size:200"`
	
	// Foreign key relationship
	User User `json:"user" gorm:"foreignKey:UserID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
}

// TableName specifies the table name for Reward model
func (Reward) TableName() string {
	return "rewards"
}